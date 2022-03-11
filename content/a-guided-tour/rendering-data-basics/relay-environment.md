## Relay Environment Provider

Relay 컴포넌트를 렌더링하기 위해 어플리케이션의 root 에 `RelayEnvironmentProvider` 컴포넌트를 선언해야 한다.

```jsx
const {RelayEnvironmentProvider} = require('react-relay');
const Environment = require('MyEnvironment');

function Root() {
  return (
    <RelayEnvironmentProvider environment={Environment}>
      {/*... */}
    </RelayEnvironmentProvider>
  );
}
```

`RelayEnvironmentProvider` 는 모든 자식 Relay 컴포넌트에서 사용할 수 있고 Relay 를 사용하는데 필요한 환경을 제공한다.

## Relay Environment 접근하기

`RelayEnvironmentProvider` 컴포넌트의 자식 컴포넌트에서 relay 환경에 접근하기 위해 `useRelayEnvironment` Hook을 사용한다.

```typescript jsx
const {useRelayEnvironment} = require('react-relay');

function UserComponent(props: Props) {
  const environment = useRelayEnvironment();

  const handler = useCallback(() => {
      // relay 환경을 요구하는 함수에게 environment 을 전달할 수 있다
      commitMutation(environment, ...);
  }, [environment])

  return (...);
}
```
