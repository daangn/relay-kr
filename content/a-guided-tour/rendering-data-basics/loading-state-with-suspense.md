# `Suspense` 를 이용한 loading 상태

`usePreloadedQuery`와 `useLazyLoadQuery` 를 사용해 서버에서 가져온 데이터를 렌더링 하려고 한다.  이 때 데이터를 받아오는 동안 로딩 UI(예: Spinner)를 렌더링하는 방법에 대해 알아보자.

query 를 통해 데이터를 가져오는 동안 loading 상태를 렌더링하기 위해 React `Suspense` 를 사용한다. `Suspense`는 비동기적으로 받아오는 자원(예: 코드, 이미지 또는 데이터)을 불러오기 위해 렌더링을 interrupt 하거나 suspend 할 수 있는 React의 새로운 기능이다.

컴포넌트를 suspend 하면 아직 렌더링을 진행할 준비 상태가 아닌 것으로 판단하고, 비동기적인 자원들을 불러올 때까지 렌더링하지 않도록 React 에게 알린다. 비동기적으로 받아오는 자원들을 다 불러오면 React는 컴포넌트를 다시 렌더링하려고 시도한다.

이 기능은 컴포넌트가 렌더링에 필요한 데이터, 코드 또는 이미지와 같은 비동기적인 의존성을 표현하는데 유용하다. 비동기적인 자원들을 다 불러와서 사용할 수 있을 때 React 는 컴포넌트 트리를 타고 로딩 상태를 재배치한다.

일반적인 상황에서  `Suspense` 를 사용하면 앱을 초기화하거나 다른 상태로 전환할 때 의도적으로 설계한 loading state 를 구현하여 사용자가 loading state 를 더 잘 제어할 수 있게 한다. 이것은 loading 을 시작해서 완료하기까지의 단계들을 명시적으로 설계하지 않았을 때, 로딩 UI(예: Spinner)가 우발적으로 깜박거리는 것 또한 막을 수 있다.

```
위 이야기가 Data Fetching 를 위한 Suspense 기능이 stable 하게 사용할 수 있다고 이야기하는 것은 아니다. 
React 17에서 Suspense 를 사용할 때 몇 가지 제약은 있지만 Relay Hooks 과의 조합은 안정적이며 
이후 React 버전에서 stable 하게 지원할 예정이다.
```

## loading fallback 을 이용한 Suspense 

컴포넌트가 suspend 하면 컴포넌트가 렌더링 준비 상태가 될 때 까지 대체할 수 있는 컴포넌트가 필요하다. 이것이 fallback 컴포넌트이다.

`Suspense` 컴포넌트는 모든 컴포넌트를 감쌀 수 있다. 컴포넌트가 suspend 하면 `Suspense` 는 자신이 감싼 모든 컴포넌트가 준비 상태가 될 때까지 fallback 컴포넌트를 렌더링한다.

이것은 `Suspense` 컴포넌트가 감싼 모든 자식 컴포넌트가 준비 상태가 될 때까지 fallback 컴포넌트를 렌더링하는 것을 의미한다.

일반적으로 fallback 컴포넌트로 Spinner 나 placeholders 같은 컴포넌트를 사용하며, 여러 컴포넌트를 interrupt 할 수 있으므로 `Suspense` 로 interrupt 를 완료할 때까지 loading 상태를 표시할 수 있다.

```jsx
const React = require('React');
const {Suspense} = require('React');

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MainContent />
    </Suspense>
  );
}
```
위의 코드를 보자.

`MainContent` 컴포넌트가 비동기적으로 받아오는 자원을 기다리고 있기 때문에 suspend 하는 경우 `MainContent` 를 감싼 `Suspense` 컴포넌트는 suspend 상태를 감지하고 

`MainContent` 가 준비 상태가 될 때까지 fallback 컴포넌트인 `LoadingSpinner` 를 렌더링한다. 

이 때 `MainContent` 의 자식 컴포넌트 역시 suspend 하는 경우, 자식 컴포넌트 모두가 준비상태가 될 때까지 기다린다.

`Suspense` 는 또한 자식 컴포넌트를 둘 이상 감싸서 좀 더 세부적으로 loading state 를 관리할 수 있다는 장점이 있다.

```jsx
const React = require('React');
const {Suspense} = require('React');

function App() {
  return (
    // LoadingSpinner 는 모든 자식이 준비 상태가 될 때까지 fallback 컴포넌트로 나타난다.
    <Suspense fallback={<LoadingSpinner />}>
      <MainContent />
      <SecondaryContent /> {/* SecondaryContent 역시 suspend 할 수 있다 */}
    </Suspense>
  );
}
```

위와 같은 경우 `MainContent` 와 `SecondaryContent` 는 두 개의 컴포넌트 모두 비동기적인 자원을 불러오기 위해 suspend 할 수 있다. 

두 개의 컴포넌트를 `Suspense` 로 감싸 모든 준비가 완료될 때까지 단일 로드 상태를 표시한 뒤, 모든 컴포넌트가 비동기적인 자원을 성공적으로 불러오면 단 한 번의 painting 으로 전체 콘텐츠를 렌더링할 수 있다.

한편, loading UI 를 더 세밀하게 결정하기 위해 더 작은 자식 컴포넌트나 개별적인 자식 컴포넌트를 `Suspense` 컴포넌트로 감쌀 수도 있다.

```jsx
const React = require('React');
const {Suspense} = require('React');

function App() {
  return (
    <>
      {/* 여기서는 LeftHandColumn 라는 별개의 fallback 컴포넌트를 loading UI 로 보여준다 */}
      <Suspense fallback={<LeftColumnPlaceholder />}>
        <LeftColumn />
      </Suspense>
      <Suspense fallback={<LoadingSpinner />}>
        <MainContent />
        <SecondaryContent />
      </Suspense>
    </>
  );
}
```

위의 예시의 경우, 각각 2개의 개별적인 loading UI 를 표시한다.

`LeftColumn` 이 준비 상태가 될 때까지, fallback 컴포넌트로 `LeftColumnPlaceholder` 를 표시하고, 

`MainContent` 와 `SecondaryContent` 가 모두 준비 상태가 될 때까지 fallback 컴포넌트로 `LoadingSpinner` 를 표시한다.

이렇게 함으로써 얻는 큰 장점이 있다. `Suspense` 에서 컴포넌트를 더 세분화하여 어느 한 컴포넌트가 준비 상태가 되는대로 다른 컴포넌트보다 더 먼저 렌더링할 수 있다는 점이다. 

예를 들어, `LeftColumn` 컴포넌트는 준비 상태가 되는대로 먼저 렌더링하여 `MainContent` 와 `SecondaryContent` 보다 먼저 렌더링할 수 있다. 

## suspend 한 컴포넌트 전환과 업데이트

`Suspense` 의 fallback 컴포넌트를 사용해 loading UI 를 표시할 수도 있지만, 다른 콘텐츠 간 전환하는 경우에도 나타낼 수 있다. 

`Suspense` 로 감싼 두 컴포넌트가 있고 하나의 컴포넌트가 다른 컴포넌트로 전환하는 상황을 예로 들어보자. 

이 때 전환하려는 컴포넌트가 비동기적인 종속성을 미처 불러오지 못할 수 있으며, 이것은 suspend 한 상황으로 해석할 수 있다.

이런 상황에서도 fallback 컴포넌트를 나타낼 수 있다. 하지만 이것은 fallback 컴포넌트를 나타내기 위해 기존에 존재하는 컴포넌트를 숨긴 것에 불과하다.

react 의 향후 버전에서는 concurrent 렌더링을 지원할 예정이며, 이런 상황을 매끄럽게 보이도록 지원하거나 지금 예시처럼 기존에 존재하는 컴포넌트를 숨기는 옵션을 제공할 예정이다.

## Relay 에서는 어떻게 Suspense 를 사용하는가

### Queries

`Relay` 의 경우, query 를 보내는 컴포넌트는 suspend 할 수 있는 컴포넌트이므로 query 를 fetch 하는 동안 `Suspense` 를 사용하여 loading state 를 렌더링한다.

```jsx
const React = require('React');
const {graphql, usePreloadedQuery} = require('react-relay');

function MainContent(props) {
  // Fetch 및 render a query
  const data = usePreloadedQuery<...>(
    graphql`...`,
    props.queryRef,
  );

  return (...);
}
```
```jsx
const React = require('React');
const {Suspense} = require('React');

function App() {
  return (
    // fallback 컴포넌트로서 LoadingSpinner 를 렌더링한다.
    <Suspense fallback={<LoadingSpinner />}>
      <MainContent /> {/* suspend 할 가능성이 있는 컴포넌트 */}
    </Suspense>
  );
}
```

 - query 를 fetch 하는 query renderer 인 `MainContent` 컴포넌트가 있다. `MainContent` 는 query 를 fetch 할 때, 렌더링을 suspend 하여 아직 렌더링할 준비가 되지 않았다고 나타내고, query 를 fetch 하면 준비 상태가 된다. 
  
 - `MainContent` 를 감싼 `Suspense` 컴포넌트는 `MainContent` 가 suspend 된 것을 인지하고 `MainContent` 가 준비 상태가 될 때까지 fallback 컴포넌트를 렌더링한다. 이것은 결국 `MainContent` 가 query 를 fetch 할 때까지를 의미한다.

### Fragments

`Fragments` 역시 `Suspense` 와 함께 사용할 수 있다. `Suspense` 를 통해 `@defer` 된 데이터 또는 Relay Store 에서 부분적으로 사용할 수 있는 데이터의 렌더링(`partial rendering`)을 지원하는 것이 가능하다.

- `@defer` : 모든 데이터가 동일한 중요도를 가지는 것이 아니기 때문에 지연시켜서 데이터를 비동기적으로 받고 싶을 때 사용하는 directive. 그 반대의 의미로 데이터를 좀 더 빠르게 받기 위해 `@stream` 이라는 directive 를 사용하기도 한다.

### Transitions

추가적으로 relay 는 refetch 나 rendering connection 같은 API 를 제공하고, 이런 API 역시 suspend 할 수 있기 때문에 `Suspense` 와 함께 사용할 수 있다.