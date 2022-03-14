## Reusing Cached Data

Relay는 app이 사용되는 동안 발생한 여러번의 쿼리에 의해 받아와진 데이터들을 축적시키고 캐싱해둔다. 그리고 종종 우리는 네트워크를 통해 데이터를 새로 받아오지 않고 이렇게 캐싱된 데이터를 사용하길 원할 때가 있다.

아래 상황들이 이렇게 ‘캐싱된 데이터’를 이용할만한 예시이다.

- 앱 내의 탭들 사이를 이동할 때, 그리고 그 탭들을 이동할 때 데이터를 받아와야 하는 경우에 이미 한 번 방문한 적이 있는 탭은 캐싱된 데이터를 사용하기 때문에 다시 네트워크 요청이 발생하지 않음.
- 한번 피드에 렌더링된 적이 있는 포스트에 다시 접근하려 하는 경우, 포스트의 permalink 페이지는 캐시되어있기 때문에 즉시 렌더링 됨.
    - 만약 포스트의 permalink 페이지에서 지금 local에서 갖고있는 것보다 더 많은 데이터를 필요로 하더라도, 당장은 갖고있는 데이터를 사용하고 렌더링을 block시키지 않음.

## Fetch Policies

캐시된 데이터를 재사용하는 방법은 `loadQuery` 함수 내부에 `fetchPolicy` 옵션을 추가하는 것이다.  (이 `loadQuery` 함수는 `useQueryLoader` 훅에 의해 반환된 함수를 의미)

```tsx
const React = require('React');
const {graphql} = require('react-relay');

function AppTabs() {
  const [
    queryRef,
    loadQuery,
  ] = useQueryLoader<HomeTabQueryType>(HomeTabQuery);

  const onSelectHomeTab = () => {
    loadQuery({id: '4'}, {fetchPolicy: 'store-or-network'});
  }

  // ...
}
```

- `useQueryLoader` 훅에 의해 반환된 `loadQuery` 함수를 호출할 때 옵션으로 `fetchPolicy` 를 추가했다. `store-or-network` 옵션을 줬기 때문에 먼저 캐시 데이터를 확인하고, 데이터가 없는 경우에만 새로운 데이터를 fetch하도록 한다.
- `fetchPolicy` 는 다음 내용들을 결정한다.
    - 로컬 캐시에서 데이터를 사용할지
    - store(캐시)에 있는 데이터의 가용 여부에 따라 서버에서 데이터를 fetch할지

기본적으로, Relay는 로컬 캐시에 있는 쿼리를 읽어 데이터를 가져오려 한다. 하지만 그 쿼리에 대한 데이터가 없거나 업데이트가 필요할 경우에는 쿼리를 통해 네트워크 요청을 보내 전체 데이터를 다시 가져온다. 위에 있는 `store-or-network` 옵션은 사실 Relay의 기본 옵션이다.

아래와 같은 다른 옵션들도 있다.

- `store-and-network` : 로컬 캐시의 데이터를 일단 쓰지만, 항상 네트워크 요청을 다시 보냄. 데이터가 있든 없든, 최신의 것이든 아니든 상관 없음.
- `network-only` : 로컬 캐시의 데이터를 사용하지 않고 항상 네트워크 요청을 통해 새로 받은 데이터를 이용.
- `store-only` : 오직 로컬 캐시의 데이터만 재사용함. 네트워크 요청은 보내지 않음. 이 때문에 데이터 일관성에 대한 책임은 개발자에게 있음.

## Availability of Data

Relay는 데이터가 ‘가용한지’에 대해 두가지 척도를 통해 판단한다.

1. Presence of Data
2. Staleness of Data

## Presence of Data

Relay store에 있는 데이터는 수명이 있는데, 이 수명은 데이터가 가용한지를 판단할 수 있는 중요한 척도이다. 보통 Relay store 안에 있는 데이터는 첫 fetch 이후 계속 존재한다. 만약 한번도 fetch한 적이 없는 데이터라면 store에는 존재하지 않을 것이다.

그치만 수많은 쿼리들을 통해 가져온 데이터들을 전부 메모리에 저장해둘 수는 없다. 전부 저장해둔다면 우리는 불필요하게 방대하고 낡은 데이터를 위해 많은 메모리 공간을 낭비하게 될 것이다.

이 문제를 해결하기 위해 Relay는 Garbage Collector라고 하는 프로세스를 돌린다. 그러면 더 이상 쓰지 않는 데이터들을 삭제할 수 있게 된다.

### Garbage Collection in Relay

Relay는 특히 로컬 in-memory store에서 Garbage Collection을 수행한다. 어떤 컴포넌트에게도 참조되지 않는 데이터들을 삭제한다.

그치만 데이터를 재사용할 가능성도 염두에 둬야 한다. 만약 데이터가 너무 빨리 삭제돼서 재사용하려고 보니 없는 경우엔 네트워크로부터 다시 데이터를 받아와야 하기 때문에 바로 재사용할 수 없게 된다. 그래서 재사용이 일어날 데이터들은 확실하게 ‘재사용 할거다’라고 말해주는 작업이 필요하다.

### Query Retention

쿼리를 유지한다는 것은 Relay에게 쿼리와 쿼리에 관련된 데이터를 지우지 말아달라고 얘기하는것과 같다. 하나 이상의 caller가 있다면 쿼리는 store에서 지워지지 않게 된다.

기본적으로, 쿼리 컴포넌트는 `useQueryLoader` 나 `usePreloadQuery`, 혹은 다른 API를 사용한다. 쿼리 컴포넌트는 mount 된 이후 쿼리를 유지하고, unmount 된 이후 쿼리를 놓아준다. 즉 unmount 이후에는 언제라도 store에서 쿼리와 쿼리 관련 데이터들이 삭제될 수 있다.

만약 컴포넌트 생명주기와 관계 없이 쿼리를 유지하고 싶다면, `retain` 메소드를 이용하면 된다.

```tsx
// Retain query; this will prevent the data for this query and
// variables from being garbage collected by Relay
const disposable = environment.retain(queryDescriptor);

// Disposing of the disposable will release the data for this query
// and variables, meaning that it can be deleted at any moment
// by Relay's garbage collection if it hasn't been retained elsewhere
disposable.dispose();
```

- `retain` 메소드를 통해 쿼리 컴포넌트의 생명주기와는 상관 없이 쿼리를 유지할 수 있다. 그러면 이후에 다른 컴포넌트가 재사용하거나, 지금은 없지만 나중에 생길 같은 컴포넌트의 다른 인스턴스가 재사용할 수도 있다.
- `dispose` 메소드는 retain 메소드와 반대로 작동한다. 언제든지 garbage collection가 쿼리를 없앨 수 있다.

### Controlling Relay’s Garbage Collection Policy

현재 Garbage Collection을 컨트롤 할 수 있는 옵션이 두가지 정도 있다. 

- GC Scheduler
    
    `gcScheduler` 라는 함수를 Relay Store에 붙여서 Garbage Collection을 스케줄링 할 수 있다.
    
    ```tsx
    // Sample scheduler function
    // Accepts a callback and schedules it to run at some future time.
    function gcScheduler(run: () => void) {
      resolveImmediate(run);
    }
    
    const store = new Store(source, {gcScheduler});
    ```
    
    - 원래는 새 Store를 생성할 때 `gcScheduler` 를 같이 주지 않는다. 그래서 Relay는 `resolveImmediate()` 함수를 통해 garbage collection을 수행.
        - resolveImmediate는 참조가 끊어졌을 때 바로 garbage collection이 수행되도록 하는 정책.
        - 그래서 일단 위 코드는 사실상 `gcScheduler` 옵션을 주지 않은것과 같음.
    - scheduler function을 통해 garbage collection이 기본 옵션보다 덜 공격적으로 수행되도록 작성할 수도 있음. 시간이나 scheduler 속성이나 그 외에 다른 휴리스틱들을 이용하면 됨.
        - 함수의 구현부에서 `run` 콜백을 즉시 실행하면 안됨.

### Garbage Collector Buffer Size

Relay Store는 내부적으로 release buffer를 갖고 있다. 쿼리 유지랑은 상관 없이 몇 개의 쿼리를 임시로 저장한다. (몇 개의 쿼리를 저장할지는 조절이 가능) 쿼리를 원래 소유하던 쿼리 컴포넌트가 unmount 되는 등의 이유로 쿼리가 없어지더라도 일단은 release buffer에 남는다. 이렇게 하면 이전 페이지로 돌아가거나 이전 탭으로 돌아갈 때 데이터를 재사용할 수 있다.

Relay Store에 `gcReleaseBufferSize` 옵션을 주면 release buffer의 사이즈를 조절할 수 있다.

```tsx
const store = new Store(source, { gcReleaseBufferSize: 10 });
```

- 위 코드는 ReleaseBuffer의 크기를 10으로 하겠다는 뜻. 기본값이 10이기 때문에 여기서는 사실상 버퍼 크기를 바꾸지 않았음.
- 버퍼 크기를 0으로 하면 release buffer를 안쓰겠다는 뜻과 같음. 쿼리들은 즉시 release 되고 재사용될 수 없을 것.

## Staleness of Data

기본적으로, Relay는 store에 있는 데이터가 낡았을 것이라는 가정을 하지 않는다. 데이터 무효화 API를 통해 명시적으로 마킹해주거나 쿼리 캐시 만료 시간보다 오래 지난 경우가 아니라면 Relay는 데이터를 낡았다고 생각하지 않을 것이다. 

데이터가 낡았다는걸 확실히 알 때는 마킹을 해주는게 좋다. 더 이상의 mutation이 일어나지 않음을 보장할 수 있을 때가 그렇다.

Relay는 아래와 같은 API들을 제공하고 이걸 이용해 store에 있는 데이터가 낡았음을 표시할 수 있다.

### Globally Invalidating the Relay Store

조금 과격한 방법은 store에 있는 모든 쿼리 캐시를 무효화하는 것이다. 이렇게 전부를 무효화하면 Relay는 현재 캐싱된 데이터들을 전부 낡았다고 인식하게 된다.

```tsx
function updater(store) {
	store.invalidateStore();
}
```

이렇게 `invalidateStore()` 메소드를 통해 전체 store의 데이터를 무효화 할 수 있다.

- 무효화된 데이터들은 다음에 접근해 평가하려 할 때 네트워크로부터 refetch.
- updater 함수는 mutation, subscription, 혹은 로컬 store를 업데이트하는 로직의 일부로 사용할 수 있음.

### Invalidating Specific Data In The Store

조금 더 구체적으로, 어떤 데이터를 무효화 하거나 혹은 store에 있는 어떤 특정한 레코드만 무효화 하는 것도 가능하다. 바로 위의 global invalidating처럼 store 전부를 무효화하지 않고 지정된 쿼리들만 무효화된다.

```tsx
function updater(store) {
	const user = store.get('<id>');
	if(user != null) {
		user.invalidateRecord();
	}
}
```

- `invalidateRecord()` 메소드를 사용. invalidateStore과는 다르게 store의 일부 데이터(`user`)만 무효화. 이렇게 되면 `user` 레코드는 낡았다고 마킹되어 다음에 접근해 평가하려 할 때는 네트워크로부터 refetch 될 것.
- 마찬가지로 updater 함수는 mutation, subscription, 혹은 로컬 store를 업데이트하는 로직의 일부로 사용할 수 있음.

### Subscribing to Data Invalidation

위에서 ‘마킹한다’는 표현을 사용했는데, 마킹을 하면 다음 평가 시점에 refetch 하고 이렇게 다시 가져와진 데이터를 사용한다는 특징이 있다. 예를 들어 페이지 뒤로가기를 한다면 낡은 쿼리를 렌더링하려 할 것이고, Relay는 낡은 쿼리를 사용하지 않고 네트워크로부터 refetch해서 가져온 데이터를 사용할 것이다.

이런 마킹은 대부분의 경우 유용하지만, 가끔은 무효화 여부랑은 상관없이 즉시 refetch해야 할 때가 있다.

- 만약 지금 있는 페이지의 쿼리가 낡은 쿼리라면, 일부 데이터는 업데이트가 필요. 그냥 마킹하는것 만으로는 즉시 새로운 데이터를 가져오지도 않을거고 낡은 데이터를 새로운 데이터를 보여줄 수 없음.
- 이전 페이지로 이동하긴 해도 이전 페이지가 unmount되지 않았다면 이전 페이지의 뷰가 다시 평가되지도 않을 것이고, 따라서 낡은 데이터라도 그대로 사용하게 될 것이다.

이런 상황들이 있기 때문에 Relay는 `useSubscribeToInvalidationState` 라는 훅을 제공한다.

```tsx
function ProfilePage(props) {
  // Example of querying data for the current page for a given user
  const data = usePreloadedQuery(
    graphql`...`,
    props.preloadedQuery,
  )

  // Here we subscribe to changes in invalidation state for the given user ID.
  // Whenever the user with that ID is marked as stale, the provided callback will
  // be executed
  useSubscribeToInvalidationState([props.userID], () => {
    // Here we can do things like:
    // - re-evaluate the query by passing a new preloadedQuery to usePreloadedQuery.
    // - imperatively refetch any data
    // - render a loading spinner or gray out the page to indicate that refetch
    //   is happening.
  })

  return (...);
}
```

- 여기서 `useSubscribeInvalidationState` 훅은 인자로 id들이 담긴 배열을 받고, 콜백도 하나 받는다. 저 배열에 담긴 id들 중 하나라도 낡은 데이터라고 마킹된다면 콜백이 호출된다.
- 콜백 안에서는 refetch 하거나 낡은 데이터에 의존하는 현재의 뷰를 업데이트할 수 있다. 예를 들면 top-level에 있는 `usePreloadedQuery` 를 호출해 데이터를 최신 상태로 유지할 수 있다. `usePreloadedQuery` 는 낡은 쿼리를 포함하고 있기 때문에 당연히 refetch되고 store 캐시도 업데이트 될 것이다.

### Query Cache Expiration Time

캐싱된 데이터를 가지고 어떤 operation을 수행하는데는 ‘쿼리 캐시 만료 시간’도 영향을 준다.

- 쿼리 캐시 만료 시간 이후로 새롭게 fetch되지 않은 쿼리이거나
- 쿼리가 포함하는 레코드들 중 적어도 하나가 무효화된 레코드일 경우

그리고 store에 있는 레코드들로만 쿼리를 수행할 수 있을 때 이를 오래된 쿼리라고 한다. 

쿼리가 낡았는지는 새로운 request가 만들어졌을 때 판단한다. `loadQuery` 를 호출할 때가 그렇죠. 오래된 데이터라도 이를 참조하는 컴포넌트에 의해 계속 렌더링될 수 있다. 하지만 오래된 데이터를 이용해 만들어진 추가 요청은 네트워크를 통해 새로운 데이터를 받아온다.

```tsx
const store = new Store(source, { queryCacheExpirationTime : 5 * 60 * 1000 });
```

쿼리 캐시 만료시간 역시 마찬가지로 Store를 생성할 때 옵션으로 줄 수 있다.

쿼리 캐시 만료시간 옵션을 따로 주지 않으면 낡은 쿼리인지 검사하는 작업은 참조된 레코드가 무효화되었는지 여부만 체크한다. 만료시간이 따로 지정되지 않는다는 뜻이다.
