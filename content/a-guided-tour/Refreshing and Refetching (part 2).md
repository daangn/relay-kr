# Refreshing and Refetching (part. 2)

## 프래그먼트 리프레싱

“refreshing a fragment”이라는 것은, 기존에 프래그먼트로 렌더했던 데이터와 똑같은 데이터를 패칭하여 해당 데이터의 가장 최신 버전을 서버로부터 받아오는 것을 의미한다.

### real-time 특징 이용하기

서버로부터 가장 최신 버전의 데이터를 받아오기 위해서 첫번째로 할 일은, real-time 피쳐를 이용하는 것이 적절한지 판단하는 것이다. 이는 데이터를 주기적으로 수동으로 리프레시 할 필요 없이, 자동적으로 최신 버전이 유지되도록 한다.

real-time 기능의 예시로는 GraphQL Subscription이 있는데, 이를 사용하기 위해서는 서버와 네트워크 계층에 추가적인 configuration이 필요하다.

### `useRefetchableFragment`

프래그먼트의 데이터를 수동적으로 리프레시하기 위해서는, 프래그먼트를 포함한 쿼리를 리패치해야 한다. *주의할 점은, 프래그먼트는 쿼리 없이 그 자체로 패치될 수 없다. 반드시 쿼리의 일부로써 존재해야 하기 때문에, 손쉽게 프래그먼트 자체를 “패치"할 수 없다.*

프래그먼트 리프레시를 위해서는, `useRefetchableFragment` 훅과 `@refetchable` 디렉티브를 함께 사용하면 된다. 이는 프래그먼트를 리패치하기 위한 쿼리를 자동으로 생성하여 `refetch` 를 사용해 프래그먼트를 패치할 수 있도록 한다.

```jsx
import type {UserComponent_user$key} from 'UserComponent_user.graphql';
// @refetchable 에 따라 릴레이가 자동 생성해준 타입
import type {UserComponentRefreshQuery} from 'UserComponentRefreshQuery.graphql';

type Props = {
  user: UserComponent_user$key,
};

function UserComponent(props: Props) {
  const [data, refetch] = useRefetchableFragment<UserComponentRefreshQuery, _>(
    graphql`
      fragment UserComponent_user on User
			# @refetchable 가 프래그먼트를 패치하기 위해 릴레이가 쿼리를 자동 생성해준다.
      @refetchable(queryName: "UserComponentRefreshQuery") {
        id
        name
        friends {
          count
        }
      }
    `,
    props.user,
  );

	return (
	  <>
	    <h1>{data.name}</h1>
	    <div>Friends count: {data.friends?.count}</div>
	    <Button
	      onClick={() => refresh()}>
	      Fetch latest count
	    </Button>
	  </>
  );
}
```

```jsx

  const refresh = useCallback(() => {
		// 빈 변수 `{}`로 리패치 하는 경우;
		// 프래그먼트를 패치했던 기존의 변수를 사용하여 @refetchable 를 사용한 쿼리를 리패치 할 수 있고,
		// 따라서 가장 최신에 패치된 데이터로 컴포넌트를 업데이트 할 수 있다.
		// 'network-only' fetchPolicy는 항상 서버로부터 패치함을 보장하고 로컬 데이터 캐시를 사용하지 않도록 한다.
    refetch({}, {fetchPolicy: 'network-only'})
  }), [/* ... */];
```

- `useRefetchableFragment` 는 `useFragment` 와 비슷하게 작동하는데, 다음과 같은 점이 추가된다.
    - `@refetchable` 디렉티브로 표시된 프래그먼트를 예상한다. `@refetchable` 디렉티브는 “리패치 가능한” 프래그먼트에만 사용 가능한데, 이는 `Viewer` / `Query` / `Node` 를 상속받는 모든 타입 (`id` 필드를 가지고 있는 타입) 에 존재하는 프래그먼트를 의미한다.
- 이는 `refetch` 함수를 리턴하는데,
    - Flow-type 되어 생성된 쿼리가 예상하는 쿼리 변수를 예측한다.
    - 두 개의 Flow 타입 매개변수를 갖음: 생성된 쿼리의 타입 (e.g. `UserComponentRefreshQuery`) 과 이미 추론 가능한 두번째 타입을 제공하여 `_` 를 전달해도 된다.
- `refetch` 는 2가지 주요 input과 함께 호출한다.
    - 첫번째 인자는 프래그먼트를 패치하기 위한 변수 세트이다.
    위의 경우, `refetch` 를 호출하고 빈 변수 세트를 전달하면 처음 프래그먼트를 패치할 때 사용한 똑같은 변수를 다시 사용하여 프래그먼트를 패치하게 되므로, 리프레시로써 작동한다.
    - 두번째 인자는 `'network-only'` `fetchPolicy` 를 전달하여 네트워크로부터 패치하고 로컬 데이터 캐시를 사용하지 않음을 보장한다.
- `refetch` 를 호출하면 컴포넌트를 리렌더링하고, 우리가 사용하는 `fetchPolicy` 에 따라 네트워크 요청이 발생하므로 `useRefetchableFragment` 가 suspend 된다. 이는 즉, suspend 될 때 fallback 로딩 상태를 나타내기 위해 해당 컴포넌트를 `Suspense` 바운더리로 감싸야 함을 내포한다.

### Suspense 사용을 피해야 할 때

몇몇의 경우, 이미 렌더된 콘텐츠를 숨기는 Suspense fallback을 보여주지 않아야 할 때가 있다. 이러한 경우, `fetchQuery` 를 사용하여 로딩 상태를 수동적으로 추적할 수 있다.

```jsx
import type {UserComponent_user$key} from 'UserComponent_user.graphql';
// @refetchable에 따라 릴레이가 자동 생성한 타입
import type {UserComponentRefreshQuery} from 'UserComponentRefreshQuery.graphql';

type Props = {
  user: UserComponent_user$key,
};

function UserComponent(props: Props) {
  const [data, refetch] = useRefetchableFragment<UserComponentRefreshQuery, _>(
    graphql`
      fragment UserComponent_user on User
			# @refetchable은 아래의 프래그먼트를 패칭하기 위한 쿼리를 자동 생성한다.
      @refetchable(queryName: "UserComponentRefreshQuery") {
        id
        name
        friends {
          count
        }
      }
    `,
    props.user,
  );

  return (
    <>
      <h1>{data.name}</h1>
      <div>Friends count: {data.friends?.count}</div>
      <Button
        disabled={isRefreshing}
        onClick={() => refresh()}>
        Fetch latest count {isRefreshing ? <LoadingSpinner /> : null}
      </Button>
    </>
  );
}
```

```jsx
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refresh = useCallback(() => {
    if (isRefreshing) { return; }
    setIsRefreshing(true);

		// fetchQuery는 쿼리를 패치하고 릴레이 스토어에 데이터를 쓴다.
		// 따라서 리렌더링 시, 데이터가 이미 캐시되어 suspend 할 필요가 없다.
    fetchQuery(environment, AppQuery, variables)
      .subscribe({
        complete: () => {
          setIsRefreshing(false);

					// 쿼리가 패치된 **이후**에,
					// refetch를 다시 호출하여 업데이트된 데이터로 리렌더링한다.
					// 쿼리를 위한 데이터는 캐시되어야 하므로,
					// 'store-only' fetchPolicy를 사용하여 suspending을 방지한다.
          refetch({}, {fetchPolicy: 'store-only'});
        },
        error: () => {
          setIsRefreshing(false);
        }
      });
  }, [/* ... */]);
```

- 이젠 리프레싱 할 때, suspending을 피하기 때문에 우리만의 `isRefreshing` 로딩 상태를 추적할 수 있다. 이 상태를 사용하여 콘텐츠 숨김 없이 컴포넌트 내 busy 스피너나 로딩 UI를 렌더링 할 수 있다.
- 이벤트 핸들러에서, 먼저 `fetchQuery` 를 호출하여 쿼리를 패치하고 로컬 릴레이 스토어에 데이터를 저장한다. `fetchQuery` 네트워크 요청이 끝나면, `refetch` 를 호출하여 이전의 예시와 비슷하게 업데이트 된 데이터를 렌더링하도록 한다.
- 이 점에서 `refetch` 가 호출되면, 프래그먼트를 위한 데이터는 로컬 릴레이 스토어에 캐시되어 있어야 한다. 이를 통해 `store-only` `fetchPolicy` 를 사용하여 suspending을 피하고 이미 캐시된 데이터만 읽을 수 있다.

## 다른 데이터로 프래그먼트 리패칭하기

“refetching a fragment”는 이미 특정 프래그먼트로 렌더링된 데이터와 다른 버전의 데이터를 패칭하는 것을 의미한다. 예를 들어, 현재 선택된 아이템을 변경할 때, 이미 보여지는 아이템 리스트와 다른 아이템들을 렌더링 할 때, 혹은 더 일반적인 경우 현재 렌더링된 콘텐츠에서 새롭거나 다른 콘텐츠를 렌더링 하는 상태로 변화할 때 프래그먼트를 리패칭 한다.

개념적으로, 이는 현재 렌더링된 프래그먼트를 다시 패칭과 렌더링하는 것을 의미하지만, 다른 변수를 사용한 새로운 쿼리 또는 새로운 쿼리 루트에서 프래그먼트를 렌더링 하는 것을 의미한다.

### `useRefetchableFragment`

```jsx
import type {CommentBodyRefetchQuery} from 'CommentBodyRefetchQuery.graphql';
import type {CommentBody_comment$key} from 'CommentBody_comment.graphql';

type Props = {
  comment: CommentBody_comment$key,
};

function CommentBody(props: Props) {
  const [data, refetch] = useRefetchableFragment<CommentBodyRefetchQuery, _>(
    graphql`
      fragment CommentBody_comment on Comment
      @refetchable(queryName: "CommentBodyRefetchQuery") {
        body(lang: $lang) {
          text
        }
      }
    `,
    props.comment,
  );

  return (
    <>
      <p>{data.body?.text}</p>
      <Button
        onClick={() => refetchTranslation()}>
        Translate Comment
      </Button>
    </>
  );
}
```

```jsx
const refetchTranslation = () => {
		// 새로운 변수를 이용해 refetch를 호출하면
		// @refetchable 쿼리를 그 새로운 변수들을 이용해 리패치하고
		// 가장 최신의 패치된 데이터로 해당 컴포넌트를 업데이트 한다.
    refetch({lang: 'SPANISH'});
  };
```

- `refetch` 는 2가지 주요 input과 함께 호출한다.
    - 첫번째 인자는 프래그먼트를 패치하기 위한 변수 세트이다.
    위의 경우, `refetch` 를 호출하고 새로운 변수 세트를 전달하면 새롭게 전달된 변수와 함께 프래그먼트를 해치한다. 이 때 제공해야 하는 변수는 `@refetchable` 쿼리가 예상하는 변수 subset 이다. 프래그먼트가 `id` 필드를 갖고 있는 경우 쿼리는 `id` 를 요구하고, 다른 변수 또한 프래그먼트에서 사용하는 필드를 요구한다.
        - 위의 경우 현재 코멘트 `id` 와 `translationType` 변수를 위한 새로운 값을 전달하여 번역된 코멘트 내용을 패치한다.
    - 위의 경우 두번째 옵션 인자를 전달하지 않는데, 이는 디폴트 `fetchPolicy` 인 `store-or-network` 를 사용하여 해당 프래그먼트를 위한 새로운 데이터가 이미 캐시된 경우 네트워크 요청을 스킵함을 의미한다.

### Suspense 사용을 피해야 할 때

```jsx
import type {CommentBodyRefetchQuery} from 'CommentBodyRefetchQuery.graphql';
import type {CommentBody_comment$key} from 'CommentBody_comment.graphql';

type Props = {
  comment: CommentBody_comment$key,
};

function CommentBody(props: Props) {
  const [data, refetch] = useRefetchableFragment<CommentBodyRefetchQuery, _>(
    graphql`
      fragment CommentBody_comment on Comment
      @refetchable(queryName: "CommentBodyRefetchQuery") {
        body(lang: $lang) {
          text
        }
      }
    `,
    props.comment,
  );

  return (
    <>
      <p>{data.body?.text}</p>
      <Button
        disabled={isRefetching}
        onClick={() => refetchTranslation()}>
        Translate Comment {isRefetching ? <LoadingSpinner /> : null}
      </Button>
    </>
  );
}
```

```jsx
  const [isRefetching, setIsRefreshing] = useState(false)
  const refetchTranslation = () => {
    if (isRefetching) { return; }
    setIsRefreshing(true);

    fetchQuery(environment, AppQuery, variables)
      .subscribe({
        complete: () => {
          setIsRefreshing(false);

          refetch({lang: 'SPANISH'}, {fetchPolicy: 'store-only'});
        }
        error: () => {
          setIsRefreshing(false);
        }
      });
  };
```