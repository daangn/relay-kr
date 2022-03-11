# 에러 상태와 ErrorBoundaries

`ErrorBoundary` 컴포넌트를 사용하여 렌더링 중 발생하는 오류를 포착하고 발생 시 fallback 컴포넌트를 오류 UI로 렌더링할 수 있다. 

작동 방식은 `Suspense` 가 작동하는 방식과 유사하다. `ErrorBoundary` 로 컴포넌트 트리를 감싼 뒤 오류가 발생했을 때의 이벤트 처리를 하면 된다.

`ErrorBoundary` 는 단순히 정적 `getDerivedStateFromError` 메서드를 구현하는 컴포넌트이다.

```typescript jsx
const React = require('React');

type State = {error: ?Error};

class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error): State {
    // Set some state derived from the caught error
    return {error: error};
  }
}
```
```jsx
const ErrorBoundary = require('ErrorBoundary');
const React = require('React');

const MainContent = require('./MainContent.react');
const SecondaryContent = require('./SecondaryContent.react');

function App() {
    // MainContent 또는 Secondary Content 에서 에러가 발생했을 때 fallback 컴포넌트를 렌더링한다.
    <ErrorBoundary fallback={error => <ErrorUI error={error} />}>
      <MainContent />
      <SecondaryContent />
    </ErrorBoundary>
  );
}
```

- `ErrorBoundary` 를 사용하여 자식 컴포넌트를 감싸고, 자식 컴포넌트에서 에러가 발생했을 때 fallback 컴포넌트를 렌더링한다.
 
- `ErrorBoundary` 로 자식 컴포넌트를 감쌌을 때 에러 UI 를 세분화해서 제어할 수 있다. 예를 들어 `MainContent` 또는 `SecondaryContent` 어느 한 쪽에서만 에러가 발생해도 fallback 컴포넌트를 렌더링한다.

## 에러 발생 후 재시도

### `useQueryLoader` 또는 `loadQuery` 사용하기

- `useQueryLoader` 또는 `loadQuery` 를 사용하여 query 를 fetch 할 때 에러가 발생한다면, 재시도를 할 때 `loadQuery` 를 다시 호출하고 새로운 query reference 를 `usePreloadedQuery` 에 전달할 수 있다.

```typescript jsx
const React = require('React');

class ErrorBoundaryWithRetry extends React.Component<Props, State> {
  state = {error: null};

  static getDerivedStateFromError(error): State {
    return {error: error};
  }

  _retry = () => {
    // loadQuery 호출을 종료하면서 새로운 queryRef 를 렌더링한다.
    this.props.onRetry();
    this.setState({
      // 에러 초기화
      error: null,
    });
  }

  render() {
    const {children, fallback} = this.props;
    const {error} = this.state;
    if (error) {
      if (typeof fallback === 'function') {
        return fallback({error, retry: this._retry});
      }
      return fallback;
    }
    return children;
  }
}
```

```jsx
const ErrorBoundaryWithRetry = require('ErrorBoundaryWithRetry');
const React = require('React');

const MainContent = require('./MainContent.react');

const query = require('__generated__/MainContentQuery.graphql');

function App(props) {
  // initialQueryRef 는 router 등으로 받아온다. 
  const [queryRef, loadQuery] = useQueryLoader(query, props.initialQueryRef);

  return (
    <ErrorBoundaryWithRetry
      // retry 에서 loadQuery 호출할 때, useQueryLoader 로부터 새로운 queryRef 를 업데이트한다.
      onRetry={() => loadQuery(/* ... */)}
      fallback={({error, retry}) =>
        <>
          <ErrorUI error={error} />
          {/* ErrorBoundary 가 자식 컴포넌트로 감싸고 있는 queryComponent 를 리렌더링할 때 사용하는 버튼 */}
          <Button onPress={retry}>Retry</Button>
        </>
      }>
      {/* loadQuery 를 다시 호출했을 때 queryRef 값을 갱신한다.*/}
      <MainContent queryRef={queryRef} />
    </ErrorBoundaryWithRetry>
  );
}

function MainContent(props) {
  const data = usePreloadedQuery(
    graphql`...`,
    props.queryRef
  );

  return (/* ... */);
}
```

- `retry` 를 호출하면 error 를 초기화하고 `loadQuery` 를 다시 호출한다. 이후 query 를 다시 fetch 하여 새로운 query reference 를 가져오고 `usePreloadedQuery` 로 전달할 수 있다.
 
- 위 코드에서 `ErrorBoundaryWithRetry` 는 error 를 초기화 한 뒤 query 를 다시 불러와 `usePreloadedQuery` 를 사용하는 컴포넌트에 새로운 query reference 를 전달하여 다시 렌더링 할 수 있도록 retry 함수를 제공한다. 
 
- 해당 컴포넌트는 새로운 query reference 를 사용하고 필요한 경우에는 네트워크 요청을 suspend 한다.

### `useLazyLoadQuery` 를 사용하는 경우

`useLazyLoadQuery` 를 사용하여 query 를 fetch 할 때 에러가 발생하고 재시도를 하려고 한다면, 

query 컴포넌트를 re-mount 하고 새로운 fetchKey 를 props 로 전달하면서 query 컴포넌트를 다시 평가할 수 있다. 

```typescript jsx
const React = require('React');

class ErrorBoundaryWithRetry extends React.Component<Props, State> {
  state = {error: null, fetchKey: 0};

  static getDerivedStateFromError(error): State {
    return {error: error, fetchKey: 0};
  }

  _retry = () => {
    this.setState(prev => ({
      // 에러 초기화
      error: null,
      // useLazyLoadQuery 를 이용한 query 의 재평가를 위해 값을 증가시킨다.
      fetchKey: prev.fetchKey + 1,
    }));
  }

  render() {
    const {children, fallback} = this.props;
    const {error, fetchKey} = this.state;
    if (error) {
      if (typeof fallback === 'function') {
        return fallback({error, retry: this._retry});
      }
      return fallback;
    }
    return children({fetchKey});
  }
}
```

```jsx
const ErrorBoundaryWithRetry = require('ErrorBoundaryWithRetry');
const React = require('React');

const MainContent = require('./MainContent.react');

function App() {
  return (
    <ErrorBoundaryWithRetry
      fallback={({error, retry}) =>
        <>
          <ErrorUI error={error} />
            {/* ErrorBoundary 가 자식 컴포넌트로 감싸고 있는 queryComponent 를 리렌더링할 때 사용하는 버튼 */}
            <Button onPress={retry}>Retry</Button>
        </>
      }>
      {({fetchKey}) => {
          {/* loadQuery 를 다시 호출했을 때 fetchKey 값을 갱신한다.*/}
          return <MainContent fetchKey={fetchKey} />;
      }}
    </ErrorBoundaryWithRetry>
  );
}

function MainContent(props) {
  const data = useLazyLoadQuery<AppQuery>(
      graphql`
        query AppQuery($id: ID!) {
          user(id: $id) {
            name
          }
        }
      `,
      {id: 4},
      {fetchKey: props.fetchKey},
  );

  return (/* ... */);
}
```

retry 를 호출하면 error 를 초기화하고 `fetchKey` 의 값을 1 증가시켜서 `useLazyLoadQuery` 에 전달할 수 있습니다. 

이 경우 새 `fetchKey` 로 `useLazyLoadQuery` 를 사용하는 컴포넌트를 리렌더링해서 `useLazyLoadQuery` 에 대한 새로운 호출 상황에서 query 를 다시 fetch 하도록 한다.

## GraphQL response 에서 에러 접근하기

사용자 친화적인 메시지를 표시하기 위해 애플리케이션의 에러에 접근하려는 경우 GraphQL 스키마의 일부로 오류 정보를 모델링하고 노출하는 것이다.

예를 들어, 예상 결과를 반환하는 스키마의 필드를 노출하거나 해당 필드를 확인하는 동안 오류가 발생한 경우(null을 반환하는 대신) Error 개체를 노출할 수 있다.

```typescript
type Error {
  # User friendly message
  message: String!
}

type Foo {
  bar: Result | Error
}
```
