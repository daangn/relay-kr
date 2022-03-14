# Reusing Cached Data for Rendering (part. 2)

## 부분적으로 캐시된 데이터 렌더링하기

앞서 설명했듯, 릴레이에서는 캐시된 데이터를 이용해 부분적으로 렌더링 할 수 있다. 우리는 **“부분적 렌더링”**을 **부분적으로 캐시된 쿼리를 즉시 렌더링 할 수 있는 ability** 라고 정의한다. 즉, 쿼리의 **일부가 빠질 수 있**지만, 쿼리의 나머지 부분은 이미 캐시되었을 것이라는 의미이다. 이러한 경우, 쿼리의 전체가 패치되기를 기다리지 않아도 이미 캐시된 쿼리를 **즉시 렌더링** 할 수 있다.

이는 화면이나 페이지를 **가능한 한 빨리 렌더링**하고 싶은 시나리오에 유용하게 사용될 수 있다. 해당 페이지의 일부 데이터는 이미 캐시되어 있기 때문에 **로딩 상태를 스킵**할 수 있기 때문이다. 예를 들어, *프로필 페이지* 를 생각해보자:

*유저의 이름*은 앱을 사용하는 동안 캐시될 가능성이 높기 때문에, *프로필 페이지를 방문할 때* 이미 유저의 이름이 캐시된 상태라면, 해당 페이지의 다른 데이터가 사용 불가능한 상태임에도 *이름이라도 즉시 렌더링* 하는 것이 이상적이다.

### 부분적인 렌더링을 위해 Fragments를 바운더리로 사용하기

부분적으로 캐시된 데이터를 렌더링하기 위해서는, **fragment 컴포넌트를 suspend** 하면 된다. *Fragment Component 는 **해당 컴포넌트에 선언된 어떤 데이터가 렌더링 할 때 없는 경우 suspend** 할 것이다.* 구체적으로, 해당 컴포넌트가 필요로 하는 데이터가 패치될 때까지 컴포넌트는 suspend 될 것이고, 해당 컴포넌트를 포함하는 쿼리가 패치 완료할 까지 계속 그 상태를 지속할 것이다.

아래와 같은 `*UsernameComponent` fragment component* 가 있다고 가정해보자:

```jsx
/**
 * UsernameComponent.react.js
 *
 * Fragment Component
 */

import type {UsernameComponent_user$key} from 'UsernameComponent_user.graphql';

const React = require('React');
const {graphql, useFragment} = require('react-relay');

type Props = {
  user: UsernameComponent_user$key,
};

function UsernameComponent(props: Props) {
  const user = useFragment(
    graphql`
      fragment UsernameComponent_user on User {
        username
      }
    `,
    props.user,
  );
  return (...);
}

module.exports = UsernameComponent;
```

그리고 다음과 같은 `*AppTabs` 쿼리 로더 컴포넌트와,*

```jsx
/**
 * AppTabs.react.js
 *
 * Query Loader Component
 */

 // ....

  const onSelectHomeTab = () => {
    loadHomeTabQuery({id: '4'}, {fetchPolicy: 'store-or-network'});
  }
```

`*HomeTab` 쿼리 컴포넌트* 가 있다고 해보자. 이 쿼리는 위의 **프래그먼트에 포함된 데이터(`...UsernameComponent_user`)를 포함하여** 가져온다.

```jsx
/**
 * HomeTab.react.js
 *
 * Query Component
 */

const React = require('React');
const {graphql, usePreloadedQuery} = require('react-relay');

const UsernameComponent = require('./UsernameComponent.react');

function HomeTab(props: Props) {
	// UsernameComponent.react.js의 프래그먼트 컴포넌트 데이터를 포함하는 쿼리
  const data = usePreloadedQuery<AppQuery>(
    graphql`
      query HomeTabQuery($id: ID!) {
        user(id: $id) {
          name
          ...UsernameComponent_user
        }
      }
    `,
    props.queryRef,
  );

  return (
    <>
      <h1>{data.user?.name}</h1>
      <UsernameComponent user={data.user} />
    </>
  );
}
```

위의 `HomeTab` 컴포넌트가 렌더링 되었을 때면, 이미 `{id: 4}` 를 가진 `User` 의 `name` 가 패치되었기 때문에 Relay 스토어에 locally 캐시되어 있게 된다.

만약 로컬에 캐시된 데이터를 재사용할 수 있게 해주는(`'**store**-or-network'` / `'**store**-and-network'`) `fetchPolicy` 를 이용해 쿼리를 렌더링하려고 하면, 다음과 같은 일이 발생한다:

- 쿼리는 로컬에서 (프래그먼트에서) 필요로 하는 데이터가 없는지 확인하는데, 위의 경우 모든 데이터가 존재한다.
    - 위의 경우, 쿼리는 `name` 만을 직접적으로 쿼리하고 있고, name은 이용 가능하기 때문에, 해당 쿼리와 연관이 있는 한 빠진 데이터는 없다고 판단된다.
    *Relay는 쿼리를 렌더링 할 때, **해당 쿼리의 모든 데이터가 패치될 때까지 (중첩된 프래그먼트를 포함하여) 트리 전체를 blocking 하는 대신, 데이터에 따라** 트리를 렌더링한다.*
    Relay가 컴포넌트에 필요한 데이터가 빠졌다고 판단할 때는 데이터가 프래그먼트(로컬)에 존재하지 않는 상태일 때다. 즉, 만약 현재의 컴포넌트를 렌더링하기 위해 필요한 데이터가 빠진 경우는 존재하지 않는다고 판단하지만, **자식 컴포넌트에 필요한 데이터는 모두 존재하는 경우는 데이터가 빠졌다고 판단하지 않는다.**
    - 쿼리가 모든 데이터를 가지고 있다고 가정하면, 쿼리 컴포넌트를 먼저 렌더링하고 자식 컴포넌트인 `UsernameComponent` 를 렌더링 할 것이다.
    - `UsernameComponent` 가 `UsernameComponent_user` 프래그먼트를 렌더링하려고 할 때, `UsernameComponent` 는 본인이 필요로 하는 데이터의 부분이 빠졌다는 것을 알 것이다. 구체적으로, 위의 경우에는 `username` 이 빠졌다. 여기서, `UsernameComponent` 는 일부가 빠진 데이터를 가지고 있기 때문에 네트워크 요청이 끝날 때까지 렌더링을 suspend 할 것이다. **어떤 `fetchPolicy` 를 골랐는지에 관계없이,** 네트워크 요청은 프래그먼트를 포함해 **전체 쿼리를 위한 일부 데이터가 빠진** 경우라면 언제든 시작될 것이다.
        
        참고. **[Fetch Policies]**
        
        - `store-or-network` (기본) : 로컬에 캐시된 데이터를 재사용하고, 쿼리에 대한 데이터의 일부가 비거나 사용 불가능 한 경우에만 네트워크 요청을 보낸다. 만약 쿼리가 모두 캐시된 상태라면, 네트워크 요청은 일어나지 않는다.
        - `store-and-network` : 로컬에 캐시된 데이터를 재사용하고 데이터의 일부가 비었든지 스토어에 있든지에 상관 없이 **항상 네트워크 요청을 보낸다.**
        - `network-only` : 로컬에 캐시된 데이터를 재사용하지 않고, 쿼리를 패치하기 위해 항상 네트워크 요청을 보낸다. 이 때 데이터의 일부가 로컬에 캐시되었는지, 비었거나 사용 불가능한지 확인하지 않고 **항상 보낸다.**
        - `store-only` : 로컬에 캐시된 데이터만을 사용하고, 절대 쿼리를 패치하기 위해 네트워크 요청을 전송하지 않는다. 이 경우, 쿼리를 패치하기 위한 책임은 caller에게 있으나, 여기서 그치지 않고 쿼리 데이터가 **fully locally 이용 가능할 때만** 데이터를 읽고 사용할 수 있다.

여기서 `UsernameComponent` 가 빠진 `username` 로 인해 suspend 된 경우, 이상적으로는 `User` 의 `name` 은 이미 로컬에 캐시된 데이터이므로 즉시 렌더링 되어야 한다. 그러나, `Suspense` 컴포넌트를 사용하여 프래그먼트의 suspension을 잡고 있지 않기 때문에, **suspension은 버블링** 되어 `App` 컴포넌트까지 suspend 시키게 된다.

`username` 이 없더라도 `App` 의 다른 컴포넌트는 `name` 이 사용 가능할 때 렌더링 될 수 있도록, `UsernameComponent` 를 `Suspense` 로 감싸기만 하면 된다.

```jsx
/**
 * HomeTab.react.js
 *
 * Query Component
 */

const React = require('React');
const {Suspense} = require('React');
const {graphql, usePreloadedQuery} = require('react-relay');

const UsernameComponent = require('./UsernameComponent.react');

function HomeTab() {
  const data = usePreloadedQuery<AppQuery>(
    graphql`
      query AppQuery($id: ID!) {
        user(id: $id) {
          name
          ...UsernameComponent_user
        }
      }
    `,
    props.queryRef,
  );

  return (
    <>
      <h1>{data.user?.name}</h1>
      <**Suspense** fallback={<LoadingSpinner label="Fetching username" />}>
        <UsernameComponent user={data.user} />
      <**/Suspense**>
    </>
  );
}
```

위의 예시를 통해 얻고자 하는 결과는 중첩된 프래그먼트를 렌더링 할 때와 똑같은 과정을 지닌다. 이는 프래그먼트를 렌더링할 때 필요한 **데이터가 로컬에 캐시되어 있는 경우, 프래그먼트 컴포넌트는 그가 지닌 자식 프래그먼트의 데이터가 빠졌는지와 관계 없이** 렌더링 될 수 있다는 것을 의미한다. 만약 자식 프래그먼트를 위한 데이터가 빠진 경우, `Suspense` 컴포넌트로 래핑하여 다른 프래그먼트와 앱의 나머지 부분은 계속해서 렌더링 될 수 있도록 할 수 있다.

위의 모든 과정은 **앱 전체가 로딩 상태에 빠지는 것을 방지**하고, **부분적으로 데이터를 렌더링** 할 수 있기 때문에 **중간 단계의 UI 상태를 렌더링** 하여 최종적으로 모든 데이터가 렌더링 된 결과와 비슷한 화면을 렌더링 할 수 있도록 한다.

## 필드 핸들러: 빠진 데이터 채워넣기

이전 파트에서 전체/ 부분적으로 캐시된 데이터를 재사용하는 방법에 대해서는 알아봤지만, 가끔 Relay가 특정 쿼리를 만족하기 위해 자동적으로 **다른 쿼리에서 이미 가져온 데이터를 재사용할 수 있도록 제공하지 못 할 때**가 있다. 구체적으로, Relay는 **이전에 패치된 쿼리에서 가져와 캐시되어 있는 데이터를 재사용** 할 수 있는 방법은 안다. 즉, 만약 **같은 쿼리를 두 번 패치**하게 될 경우, Relay는 두번째의 경우 해당 쿼리가 가져오는 데이터를 캐시된 데이터 중 골라낼 수 있다.

하지만, **다른 쿼리임에도 같은 데이터**를 가리키는 경우, 캐시된 데이터를 재사용하는 것이 이상적이다. 예를 들어, 다음과 같은 2개의 쿼리가 있다고 가정해보자:

```jsx
query UserQuery {
  user(id: 4) {
    name
  }
}
```

```jsx
query NodeQuery {
  node(id: 4) {
    ... on User {
      name
    }
  }
}
```

2개의 쿼리는 다르지만, 같은 데이터를 가리킨다. 가져오는 방법, 즉, 쿼리만 다를 뿐이다. 이상적으로, 만약 하나의 쿼리가 이미 스토어에 캐시된 경우, 다른 쿼리를 렌더링 할 때 해당 데이터를 재사용 해야한다. 그러나, Relay는 기본적으로 이러한 **로직에 대한 지식이 없기** 때문에, 우리가 **둘은 같은 데이터를 가리킨다는 지식**을 인코딩 할 수 있도록 `node(id: 4)` 는 `user(id: 4)` 라는 설정을 제공해주어야 한다.

그러기 위해서는, `missingFieldHandlers` 를 `RelayEnvironment` 에 제공하여 해당 지식을 구체화한다.

```jsx
const {**ROOT_TYPE**, Environment} = require('relay-runtime');

const missingFieldHandlers = [
  {
    handle(field, record, argValues): ?string {
      if (
        record != null &&
        **record.__typename === ROOT_TYPE** &&
        **field.name === 'user'** &&
        **argValues.hasOwnProperty('id')**
      ) {
				// 필드가 user(id: $id)인 경우,
				// $id를 이용해 record 가져오기
        return argValues.id;
      }
      if (
        record != null &&
        **record.__typename === ROOT_TYPE** &&
        **field.name === 'story'** &&
        **argValues.hasOwnProperty('story_id')**
      ) {
				// 필드가 story(story_id: $story_id)인 경우,
				// $story_id를 이용해 record 가져오기
        return argValues.story_id;
      }
      return undefined;
    },
    kind: 'linked',
  },
];

const environment = new Environment({/*...*/, missingFieldHandlers});
```

- `ROOT_TYPE` : 스토어의 루트에 담긴 `type_name`
- `missingFieldHandlers` 는 handlers를 담은 배열이다. 각각의 핸들러는 `**handle` 메소드**를 구체화하고 **빠진 필드를 핸들링하는 방법(`kind`)** 를 지녀야 한다. 핸들링하고자 하는 2개의 주요 필드 타입은:
    - `**scalar**` : 스칼라 값을 갖는 필드 e.g. number, string
    - `**linked**` : 다른 객체를 **참조**하는 필드 e.g. scalar가 아닌 값
- `handle` 메소드는 `(빠진 필드, 해당 필드가 속하는 record, 그리고 현재 쿼리를 실행하기 위해 필드에 제공되는 arguments)` 를 매개변수로 갖는다.
    - `scalar` 필드를 핸들링 할 경우, 핸들러 함수는 빠진 필드의 값으로 사용할 수 있도록 스칼라 값을 반환해야 한다.
    - `linked` 필드를 핸들링 할 경우, 핸들러 함수는 빠진 필드에 넣을 수 있도록 스토어에 있는 **다른 객체를 참조하는 `ID`** 를 반환해야 한다.
- Relay가 로컬 캐시를 이용해 쿼리를 실행하면서 **빠진 데이터를 만나는** 경우에는, 명시적으로 데이터가 없다고 표시하기 전에 **제공된 핸들러 함수 중 빠진 필드의 타입에 맞는 핸들러를 실행**시킨다.
