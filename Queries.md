 # Queries
 
 [GraphQL Query](https://graphql.org/learn/queries/) 는 GreaphQL 서버에서 `query` 하려는 데이터에 대한 설명입니다. query 는 서버에 요청하려는 필드 세트 ( 잠재적으로 Fragment)로 구성 됩니다. 쿼리할 수 있는 항목은 쿼리에 사용할 수 있는 데이터를 설명하는 서버에 노출된 [GraphQL 스키마](https://graphql.org/learn/schema/) 에 따라 다릅니다 .



데이터를 가져오기 위해서 쿼리가 사용하는 선택적 변수(variables) 컬렉션과 함께 네트워크를 통해 요청으로 보낼수있습니다. 

```TS
query UserQuery($id: ID!) {
  user(id: $id) {
    id
    name
    ...UserFragment
  }
  viewer {
    actor {
      name
    }
  }
}

fragment UserFragment on User {
  username
}
```

이 쿼리는 아래와 같은 데이터를 반환합니다. 

```JSON
{
  "data": {
    "user": {
      "id": "4",
      "name": "Mark Zuckerberg",
      "username": "zuck"
    },
    "viewer": {
      "actor": {
        "name": "Your Name"
      }
    }
  }
}
```

<br/>

## Rendering Queries

Relay에서 쿼리를 렌더링 하기 위해서 usePreloadedQuery 라는 hook 을 사용할 수 있습니다. usePreloadedQuery 는 쿼리의 정의와 참조를 매개변수로 사용하여 해당 데이터를 반환합니다.



```TS
import type {HomeTabQuery} from 'HomeTabQuery.graphql';

const React = require('React');
const {graphql, usePreloadedQuery} = require('react-relay');

type Props = {
  queryRef: PreloadedQuery<HomeTabQuery>,
};

function HomeTab(props: Props) {
  const data = usePreloadedQuery<HomeTabQuery>(
    graphql`
      query HomeTabQuery($id: ID!) {
        user(id: $id) {
          name
        }
      }
    `,
    props.queryRef,
  );

  return (
    <h1>{data.user?.name}</h1>
  );
}
```

usePreloadedQuery 는 `graphql`쿼리와 참조를 가지고 해당 쿼리에 대해 가져온 데이터를 반환합니다.

- HomeTab 이라는 컴포넌트의 경우에는  Props 로 내려받는 queryRef를 설명하고 참조하여 쿼리에 해당되는 데이터를 반환합니다.
- PreloadedQuery는 relay Complier 가 생성해주는  type parameter 를 타입으로 가지고 있습니다. 위의 경우에는 `HomeTabQuery` 의 타입이 여기에 해당됩니다.

- 프래그먼트 와 유사하게 *구성 요소는 쿼리 데이터에 대한 업데이트를 자동으로 구독합니다* . 이 쿼리에 대한 데이터가 앱의 어디에서나 업데이트되면 구성 요소는 최신 업데이트된 데이터로 자동으로 다시 렌더링됩니다.

- usePreloadedQuery 또한  type parameter 를 HomeTabQuery 로 가지고 있습니다. 

  - Relay는 다음과 같은 이름 형식으로 생성된 파일에서 가져올 수 있는 선언된 쿼리에 대해 type을 자동으로 생성한다는 것을 기억하세요.*`<query_name>`*`.graphql.js`



- 쿼리를 렌더링하기 이전에 Relay Environment Provider  로 root 를 감싸 Relay 환경이 제공되는지 확인해야합니다.

<br/>

## Fetching Queries for Render

*쿼리를 렌더링* 하는 것 외에도 쿼리데이터를 서버에서 가져와야 합니다. 일반적으로 우리는 앱의 루트 어딘가에서 하나 또는 몇개의 쿼리로  화면을 렌더링하는 데 필요한 모든 데이터들을 축적할 수있도록 만들길 원합니다. 이상적으로는 앱 렌더링을 시작하기 전에 가능한 한 빨리 가져오는 것이 좋습니다.

나중에 쿼리를 서버에서 가져오기 위해서`useQueryLoader`  Hook 을 사용할 수 있습니다 .

```js
import type {HomeTabQuery as HomeTabQueryType} from 'HomeTabQuery.graphql';
import type {PreloadedQuery} from 'react-relay';

const HomeTabQuery = require('HomeTabQuery.graphql')
const {useQueryLoader} = require('react-relay');


type Props = {
  initialQueryRef: PreloadedQuery<HomeTabQueryType>,
};

function AppTabs(props) {
  const [
    homeTabQueryRef,
    loadHomeTabQuery,
  ] = useQueryLoader<HomeTabQueryType>(
    HomeTabQuery,
    props.initialQueryRef, /* e.g. provided by router */
  );

  const onSelectHomeTab = () => {
    // Start loading query for HomeTab immediately in the event handler
    // that triggers navigation to that tab, *before* we even start
    // rendering the target tab.
    // Calling this function will update the value of homeTabQueryRef.
    loadHomeTabQuery({id: '4'});

    // ...
  }

  // ...

  return (
    screen === 'HomeTab' && homeTabQueryRef != null ?
      // Pass to component that uses usePreloadedQuery
      <HomeTab queryRef={homeTabQueryRef} /> :
      // ...
  );
}
```



- 우리는 useQueryLoader 를 AppTabs 컴포넌트 안에서 호출하고 있습니다. 

  - 이 경우 `HomeTabQuery`쿼리(이전의 예에서 선언한 쿼리)가 필요하며 `HomeTabQuery.graphql` 에서 자동 생성된 파일을  얻을 수 있습니다. 

  - 상태에 저장되고 useQueryLoader 에 의해 반환되는 `PreloadedQuery`의 초기 값으로 homeTabQueryRef를 사용 중입니다.

    

- useQueryLoader 호출을 통해 우리는 두가지를 얻을 수 있습니다. 

  - `homeTabQueryRef`: 가져오거나 가져온 쿼리입니다. 이 값은 useQueryLoader 가 호출 되지 않았을 경우 null 이 됩니다. \

  - `loadHomeTabQuery` : 아직 캐시되지 않은 경우에는 서버에서 이 쿼리에 대한 데이터를 

    가져오고, 쿼리가 예상 하는 변수가 있는 객체를 제공하는 함수 입니다. (여기서는 {id : 4})

    

    - 이 함수를 호출하면 PreloadedQuery 쿼리 대신에 homeTabQueryRef 로 쿼리를 업데이트 합니다. 

    - 또한 `렌더링 을 유발하는 이벤트 핸들러`에서 이 함수를 호출 합니다 . 이를 통해 새 탭이 렌더링을 시작하기 전에도 가능한 한 빨리 화면에 대한 데이터 가져오기를 시작할 수 있습니다.

    -  이 함수는 렌더링 중에 호출할 수 없습니다. 그렇기 때문에 *컴포넌트의 렌더 함수 외부에서 호출 해야 합니다* . 그렇지 않으면 오류가 발생합니다. 
        - HomeTab 컴포넌트가 아니라 AppTabs 컴포넌트에서 호출해야합니다. 

    

- useQueryLoader 는 컴포넌트가 언마운트 될 때   저장 된 모든 쿼리가 자동으로 삭제됩니다. 쿼리를 삭제하면 Relay가 더 이상 해당 쿼리의 특정 인스턴스에 대한 데이터를 캐시에 보관하지 않습니다. 또한 컴포넌트가 언마운트 될 때,  쿼리에 대한 요청이 아직 진행 중인 경우에는 취소됩니다.

- 역시 마지막으로 , 쿼리를 렌더링하기 이전에 Relay Environment Provider  로 root 를 감싸 Relay 환경이 제공되는지 확인해야합니다.

  <br/>
<br/>

  응용 프로그램의 초기 로드에 필요한 데이터를 가져오기 위해 부모 구성 요소의 컨텍스트 외부에서 가져와야 하는 경우가 있습니다. 

  

  이러한 경우   useQueryLoader를 사용하지 않고 `loadQuery`를 사용해서 API를 직접 사용할 수 있습니다.

```js
import type {HomeTabQuery as HomeTabQueryType} from 'HomeTabQuery.graphql';

const HomeTabQuery = require('HomeTabQuery.graphql')
const {loadQuery} = require('react-relay');


const environment = createEnvironment(...);

// At some point during app initialization
const initialQueryRef = loadQuery<HomeTabQueryType>(
  environment,
  HomeTabQuery,
  {id: '4'},
);

// ...

// E.g. passing the initialQueryRef to the root component
render(<AppTabs initialQueryRef={initialQueryRef} initialTab={...} />)
```

- 컴포넌트에 초기값으로 쿼리를 전달해주기 위한 쿼리를 얻기 위해 `loadQuery` 함수를 직접 호출합니다 
- 이 경우 루트 `AppTabs`  컴포넌트가 쿼리 참조의 수명을 관리하고 적절한 시간에 삭제할 것으로 예상합니다.
- 이 예제에서는 "앱 초기화"에 대한 세부 정보를 모호하게 남겨두었습니다. 애플리케이션마다 다를 것이기 때문입니다. 여기서 주목해야 할 중요한 점은 루트 컴포넌트 렌더링을 시작하기 전에 쿼리 참조를 얻어야 한다는 것입니다. 특히 `loadQuery` 는 렌더링 중에는 호출할 수 없습니다. 컴포넌트의 렌더 함수 외부에서 호출해야 합니다. 그렇지 않으면 오류가 발생합니다.

## Render as you Fetch

위의 예는 가능한 한 빨리 가져오기를 시작하고(fetch 를 시작하기 위해 컴포넌트가 렌더링될 때까지 기다리는 것과 반대), 사용자에게 콘텐츠를 표시할 수 있도록 데이터 fetch 과 렌더링을 분리하는 방법을 보여줍니다. 

또한 ` waterfalling round trips` 을 방지하는 데 도움이 되며 fetch가 발생하는 시기에 대해 더 많은 제어와 예측 가능성을 제공하는 반면, 렌더링 중에 가져오면 fetch가 발생하거나 발생해야 하는 시점을 결정하기가 더 어려워집니다.

 이것은 React Suspense 의 "render-as-you-fetch"패턴과 잘 맞습니다 .

이것은 Relay로 데이터를 가져오는 데 선호되는 패턴이며 몇몇의 상황에서 적용이 되는데 

 일반적으로는 처음에 UI 보여지지 않다가 나중에 상호 작용(예: 메뉴, 팝오버, 대화 상자 등) 및 추가 데이터를 가져와야 합니다.

<br/>

## Lazily Fetching Queries during Render

쿼리를 가져오는 또 다른 방법은 구성 요소가 렌더링될 때 쿼리를 느리게 가져오는 것입니다. 그러나 이전에 언급했듯이 선호되는 패턴은 렌더링 전에 쿼리 가져오기를 시작하는 것입니다. 주의 없이 지연 가져오기를 사용하면 중첩 또는 waterfalling round trips 트리거되고 성능이 저하될 수 있습니다.

쿼리를 느리게 가져오려면 `useLazyLoadQuery`Hook을 사용할 수 있습니다 .

```js
import type {AppQuery} from 'AppQuery.graphql';

const React = require('React');
const {graphql, useLazyLoadQuery} = require('react-relay');

function App() {
  const data = useLazyLoadQuery<AppQuery>(
    graphql`
      query AppQuery($id: ID!) {
        user(id: $id) {
          name
        }
      }
    `,
    {id: '4'},
  );

  return (
    <h1>{data.user?.name}</h1>
  );
}
```

- `useLazyLoadQuery` graphql 쿼리와 해당 쿼리에 대한 일부 변수를 사용하고 해당 쿼리에 대해 가져온 데이터를 반환합니다. 변수는 GraphQL 쿼리 내에서 참조 되는 변수의 값을 포함하는 객체 입니다.

- 프래그먼트와 유사하게 구성 요소는 쿼리 데이터에 대한 업데이트를 자동으로 구독합니다. 이 쿼리에 대한 데이터가 앱의 어느 곳에서나 업데이트되면 구성 요소는 최신 업데이트된 데이터로 자동으로 다시 렌더링됩니다.


  - Relay는 선언된 쿼리에 대해 type을 자동으로 생성하므로 가져오고 사용할 수 있습니다 `useLazyLoadQuery`. 이러한 유형은 다음과 같은 이름 형식으로 생성된 파일에서 사용할 수 있습니다 `<query_name>.graphql.js`.



    

  

- 기본적으로 컴포넌트 렌더링될 때 Relay는 이 쿼리에 대한 데이터를 가져오고 `useLazyLoadQuery` (아직 캐시되지 않은 경우) 이를 호출 결과로 반환합니다 . 

- 컴포넌트를 다시 렌더링 하고 원래 사용된 것과 *다른 쿼리 변수* 를 전달 하면 쿼리가 새 변수로 다시 가져와지고 잠재적으로 다른 데이터로 다시 렌더링됩니다.