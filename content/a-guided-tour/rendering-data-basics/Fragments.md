# Fragments

Relay에서 React 구성 요소에 대한 데이터 종속성을 선언하기 위한 주요 빌딩 블록은 GraphQL 프래그먼트입니다. Fragment 는  GraphQL 스키마에 제공된 재사용 가능한 units 입니다. 

실제로는 GraphQL의  필드에 해당됩니다.

```graphql
fragment UserFragment on User {
  name
  age
  profile_picture(scale: 2) {
    uri
  }
}
```

JavaScript 코드 내에서 프래그먼트를 선언하려면 다음 `graphql` 태그 를 사용해야 합니다 .

```ts
const {graphql} = require('react-relay');

const userFragment = graphql`
  fragment UserFragment_user on User {
    name
    age
    profile_picture(scale: 2) {
      uri
    }
  }
`;
```
<br/>


## Rendering 프래그먼트

프래그먼트에 대한 데이터를 렌더링하기 위해 `useFragment`Hook 을 사용할 수 있습니다 .

```ts
import type {UserComponent_user$key} from 'UserComponent_user.graphql';

const React = require('React');

const {graphql, useFragment} = require('react-relay');

type Props = {
  user: UserComponent_user$key,
};

function UserComponent(props: Props) {
  const data = useFragment(
    graphql`
      fragment UserComponent_user on User {
        name
        profile_picture(scale: 2) {
          uri
        }
      }
    `,
    props.user,
  );

  return (
    <>
      <h1>{data.name}</h1>
      <div>
        <img src={data.profile_picture?.uri} />
      </div>
    </>
  );
}

module.exports = UserComponent;
```



- `useFragment`프래그먼트 정의와 *프래그먼트 참조* 를 취하고 해당 프래그먼트 및 참조에 해당하는 데이터를 반환합니다.

- Fragment *참조* 는 Relay가 Fragment 정의에 선언된 데이터 를 읽는 데 사용하는 객체입니다.

  - 보시 다시피 `UserComponent_user` 프래그먼트 자체는 유형의 필드를 선언 하지만 해당 필드를 읽을 특정 사용자를 알아야 합니다. 이것은 프래그먼트 참조에 해당합니다. 즉, Fragment 참조는 데이터를 읽으려는 *유형의 특정 인스턴스에 대한 포인터 와 같습니다.*

  - 컴포넌트는 자동으로 조각 데이터에 대한 업데이트를 구독합니다.
  - 이 특정 데이터에 대한 데이터 `User`가 앱의 어디에서나 데이터 업데이트되면(예: 새 데이터 가져오기 또는 기존 데이터 변경을 통해) 구성 요소는 자동으로 최신 업데이트로 다시 렌더링됩니다. 

- Relay는 컴파일러가 실행될 때 선언된 모든 프래그먼트에 대한 type을 자동으로 생성하므로 이러한 유형을 사용하여 컴포넌트 props 의 타입으로 지정할 수 있습니다. 

  - 생성된 Flow 유형에는 접미사가 있는 유형인 조각 참조 유형과 `$key`접미사 `<fragment_name>$key`가 있는 유형인 데이터 모양 유형이 포함 `$data`됩니다 `<fragment_name>$data`. 이러한 유형은 다음 이름으로 생성된 파일에서 가져올 수 있습니다 `<fragment_name>.graphql.js`. .

  - 우리는 위의 예에서  user Props 가 필요한 프래그먼트 참조로 입력되고 있으며, 이는 UserComponent_user.graphql 에서 가져온 `UserComponent_user$key` 에 해당됩니다.

    

- 프래그먼트 이름은 전역적으로 고유해야 합니다. 이를 쉽게 달성하기 위해 모듈 이름과 식별자를 기반으로 다음 규칙을 사용하여 Fragment의 이름을 지정합니다 `<module_name>_<property_name>`. 이렇게 하면 어떤 프래그먼트가 어떤 모듈에 정의되어 있는지 쉽게 식별할 수 있으며 동일한 모듈에 여러 프래그먼트가 정의될 때 이름 충돌을 피할 수 있습니다.

동일한 컴포넌트 내의 여러 Fragment에서 데이터를 렌더링해야 하는 경우 `useFragment`여러 번 사용할 수 있습니다.

```ts
import type {UserComponent_user$key} from 'UserComponent_user.graphql';
import type {UserComponent_viewer$key} from 'UserComponent_viewer.graphql';

const React = require('React');
const {graphql, useFragment} = require('react-relay');

type Props = {
  user: UserComponent_user$key,
  viewer: UserComponent_viewer$key,
};

function UserComponent(props: Props) {
  const userData = useFragment(
    graphql`
      fragment UserComponent_user on User {
        name
        profile_picture(scale: 2) {
          uri
        }
      }
    `,
    props.user,
  );

  const viewerData = useFragment(
    graphql`
      fragment UserComponent_viewer on Viewer {
        actor {
          name
        }
      }
    `,
    props.viewer,
  );

  return (
    <>
      <h1>{userData.name}</h1>
      <div>
        <img src={userData.profile_picture?.uri} />
        Acting as: {viewerData.actor?.name ?? 'Unknown'}
      </div>
    </>
  );
}

module.exports = UserComponent;
```

<br/>


## Composing 프래그먼트

GraphQL에서 프래그먼트는 재사용 가능한 단위입니다. 즉, *다른* 프래그먼트를 포함할 수 있으므로 결과적으로 프래그먼트가 다른 프래그먼트 또는 쿼리내에 포함될 수 있습니다 .

```graphql
fragment UserFragment on User {
  name
  age
  profile_picture(scale: 2) {
    uri
  }
  ...AnotherUserFragment
}

fragment AnotherUserFragment on User {
  username
  ...FooUserFragment
}
```



각 React 컴포넌트는 자식의 데이터 종속성을 가져올 책임이 있습니다. 올바르게 렌더링하려면 자식의 props에 대해 알아야 하는 것과 마찬가지입니다. 이 패턴은 개발자가 컴포넌트(필요한 데이터, 렌더링하는 구성 요소)에 대해 로컬로 추론할 수 있지만 Relay는 전체 UI 트리의 데이터 종속성에 대한 전역 보기를 도출할 수 있음을 의미합니다.

- Co-location 과 관련있습니다.



```ts

/**
 * UsernameSection.react.js
 *
 * Child Fragment Component
 */

import type {UsernameSection_user$key} from 'UsernameSection_user.graphql';

const React = require('React');
const {graphql, useFragment} = require('react-relay');

type Props = {
  user: UsernameSection_user$key,
};

function UsernameSection(props: Props) {
  const data = useFragment(
    graphql`
      fragment UsernameSection_user on User {
        username
      }
    `,
    props.user,
  );

  return <div>{data.username ?? 'Unknown'}</div>;
}

module.exports = UsernameSection;
```



```js
/**
 * UserComponent.react.js
 *
 * Parent Fragment Component
 */

import type {UserComponent_user$key} from 'UserComponent_user.graphql';

const React = require('React');
const {graphql, useFragment} = require('react-relay');

const UsernameSection = require('./UsernameSection.react');

type Props = {
  user: UserComponent_user$key,
};

function UserComponent(props: Props) {
  const user = useFragment(
    graphql`
      fragment UserComponent_user on User {
        name
        age
        profile_picture(scale: 2) {
          uri
        }

        # Include child fragment:
        ...UsernameSection_user
      }
    `,
    props.user,
  );

  return (
    <>
      <h1>{user.name}</h1>
      <div>
        <img src={user.profile_picture?.uri} />
        {user.age}

        {/* Render child component, passing the _fragment reference_: */}
        <UsernameSection user={user} />
      </div>
    </>
  );
}

module.exports = UserComponent;
```



여기서 주의할 사항이 몇 가지 있습니다.

- `UsernameSection`는 `user prop`으로 프래그먼트 참조가 필요합니다. 이전에 언급했듯이 프래그먼트 참조는 Relay가 프래그먼트 정의에 선언된 데이터를 읽는 데 사용하는 객체입니다. 보시다시피 자식 `UsernameSection_user` 프래그먼트 자체는 유형의 필드를 선언 하지만 해당 필드를 읽을 특정 `User`를 알아야 합니다. 이것이 프래그먼트 참조에 해당합니다. 
  - 즉, 프래그먼트 참조는 데이터를 읽으려는 *유형의 특정 인스턴스에 대한 포인터 와 같습니다.*
- 이 경우 UsernameSection에 전달된 User, 즉 프래그먼트 참조에는 실제로 자식 UsernameSection 구성 요소에서 선언한 데이터가 포함되어 있지 않습니다.
- 대신 `UsernameSection`은 프래그먼트 참조를 사용하여 useFragment를 사용하여 내부적으로 선언된 데이터를 읽습니다.
- 이것은 부모가 자식이 선언한 데이터에 대한 종속성을 암시적으로 생성하는 것을 방지하고 그 반대의 경우도 마찬가지이므로 다른 컴포넌트에 영향을 미칠 염려 없이 컴포넌트에 대해 로컬로 추론하고 수정할 수 있습니다. 
- 그렇지 않고 부모가 자식의 데이터에 액세스할 수 있는 경우 자식이 선언한 데이터를 수정하면 부모가 손상될 수 있습니다. 이를 `데이터 마스킹`이라고 합니다.
- 자식이 예상하는 프래그먼트 참조는 `자식 프래그먼트를 포함하는 부모 프래그먼트를 읽은 결과`입니다. 우리의 위의 예에서 이는 `...UsernameSection_user를 포함하는 단편을 읽은 결과가 UsernameSection`이 예상하는 단편 참조가 됨을 의미합니다. 즉, useFragment를 통해 프래그먼트를 읽은 결과 얻은 데이터는 *해당 프래그먼트에 포함된 모든 자식 프래그먼트에 대한 프래그먼트 참조 역할*도 합니다.

<br/>

## Composing 프래그먼트 into Queries

Relay의 프래그먼트를 사용하면 컴포넌트에 대한 데이터 종속성을 선언할 수 있지만 자체적으로 가져올 수는 없습니다. 대신 쿼리에 직접 또는 간접적으로 포함되어야 합니다. 이것은 *모든 프래그먼트가 렌더링될 때 쿼리에 속해야* 함을 의미합니다 . 단일 프래그먼트는 여전히 여러 쿼리에 포함될 수 있지만 프래그먼트 구성 요소의 특정 인스턴스를 렌더링할 때 특정 쿼리 요청의 일부로 포함되어야 합니다.

프래그먼트가 포함된 쿼리를 가져오고 렌더링하려면 프래그먼트 구성 섹션 에 표시된 것처럼 프래그먼트를 구성하는 것과 동일한 방식으로 구성하면 됩니다 

```ts
/**
 * UserComponent.react.js
 *
 * Fragment Component
 */

import type {UserComponent_user$key} from 'UserComponent_user.graphql';

const React = require('React');
const {graphql, useFragment} = require('react-relay');

type Props = {
  user: UserComponent_user$key,
};

function UserComponent(props: Props) {
  const data = useFragment(
    graphql`...`,
    props.user,
  );

  return (...);
}



```

```ts
/**
 * App.react.js
 *
 * Query Component
 */

import type {AppQuery} from 'AppQuery.graphql';
import type {PreloadedQuery} from 'react-relay';

const React = require('React');
const {graphql, usePreloadedQuery} = require('react-relay');

const UserComponent = require('./UserComponent.react');

type Props = {
  appQueryRef: PreloadedQuery<AppQuery>,
}

function App({appQueryRef}) {
  const data = usePreloadedQuery<AppQuery>(
    graphql`
      query AppQuery($id: ID!) {
        user(id: $id) {
          name

          # Include child fragment:
          ...UserComponent_user
        }
      }
    `,
    appQueryRef,
  );

  return (
    <>
      <h1>{data.user?.name}</h1>
      {/* Render child component, passing the fragment reference: */}
      <UserComponent user={data.user} />
    </>
  );
}
```



참고:

- 예상 되는 *프래그먼트 참조* 는 `UserComponent`프래그먼트를 포함하는 상위 쿼리를 읽은 결과이며, 이 경우에는 `...UsernameSection_user`. 즉, 의 `data`결과로 얻은 것은 `usePreloadedQuery`해당 쿼리에 포함된 모든 하위 프래그먼트에 대한 프래그먼트 참조 역할도 합니다.
- 이전에 언급했듯이 *모든 프래그먼트는 렌더링될 때 쿼리에 속해야* 합니다.
  -  즉, 모든 프래그먼트 컴포넌트는 쿼리의 하위 항목이어야 합니다 .