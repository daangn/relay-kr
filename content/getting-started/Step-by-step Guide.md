# Step-by-step Guide

## Step 1. Create React App

```bash
# NPM
npx create-react-app your-app-name

# Yarn
yarn create react-app your-app-name
```

```bash
# NPM
cd your-app-name
npm start

# Yarn
cd your-app-name
yarn start
```

## Step 2. Fetch GraphQL (Relay 없이 fetch() 사용)

### 2.1. GitHub GraphQL Authentication

```jsx
# your-app-name/.env.local
REACT_APP_GITHUB_AUTH_TOKEN=<TOKEN>
```

### 2.2. A fetchGraphQL Helper

```jsx
// your-app-name/src/fetchGraphQL.js
async function fetchGraphQL(text, variables) {
	...

  // Fetch data from GitHub's GraphQL API:
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    ...,
    body: JSON.stringify({
      query: text,
      variables,
    }),
  });

  // Get the response as JSON
  return await response.json();
}

export default fetchGraphQL;
```

### 2.3. Fetching GraphQL From React

```jsx
// your-app-name/src/App.js
...

function App() {
  // We'll load the name of a repository, initially setting it to null
  const [name, setName] = useState(null);

  // When the component mounts we'll fetch a repository name
  useEffect(() => {
    let isMounted = true;
    fetchGraphQL(`
      query RepositoryNameQuery {
        # feel free to change owner/name here
        repository(owner: "facebook" name: "relay") {
          name
        }
      }
    `).then(response => {
      // Avoid updating state if the component unmounted before the fetch completes
			// 데이터 패칭이 완료되기 전 unMount 되는 경우 처리
      if (!isMounted) {
        return;
      }
      const data = response.data;
      setName(data.repository.name);
    }).catch(error => {
      console.error(error);
    });

    return () => {
      isMounted = false;
    };
  }, [fetchGraphQL]);

  // Render "Loading" until the query completes
  return (
    <div className="App">
      <header className="App-header">
        <p>
          {name != null ? `Repository: ${name}` : "Loading"}
        </p>
      </header>
    </div>
  );
}

export default App;
```

## Step 3. When To Use Relay (Relay 사용해 데이터 가져오기)

step2를 사용하면, 어플리케이션의 규모가 커지는 속도와 크기에 대응하기 어려워진다.

이 때 Relay를 사용하면 빠르고 믿을 수 있는 방식으로 이에 대응할 수 있는데, 이유는 다음과 같다.

1. GraphQL 프래그먼트, 데이터 일관성, mutations을 컴포넌트에 위치시켜 데이터 의존성을 모아놓기 (colocating)

## Step 4. Adding Relay To Our Project

Relay는 3가지 핵심으로 이루어져있다.

1. `relay-compiler` : 컴파일러 (빌드 타임에 사용됨)
2. `relay-runtime` : 코어 런타임 (React 친화적)
3. `react-relay` : React integration layer

```bash
# NPM Users
npm install --save relay-runtime react-relay
npm install --save-dev relay-compiler babel-plugin-relay

# Yarn Users
yarn add relay-runtime react-relay
yarn add --dev relay-compiler babel-plugin-relay
```

### 4.1. Configure Relay Compiler

Relay example app의 `.graphql` 스키마 카피를 다운로드 받기 위해

```bash
cd your-app-name
curl https://raw.githubusercontent.com/relayjs/relay-examples/main/issue-tracker/schema/schema.graphql > schema.graphql
```

package.json 설정은 다음과 같다.

```json
// your-app-name/package.json
{
  ...
  "scripts": {
    ...
    "start": "yarn run relay && react-scripts start",
    "build": "yarn run relay && react-scripts build",
    "relay": "yarn run relay-compiler $@"
    ...
  },
  "relay": {
    "src": "./src/",
    "schema": "./schema.graphql"
  }
  ...
}
```

```bash
cd your-app-name
yarn start
```

여기서, GraphQL을 사용하게 되면 Relay는 이를 감지하여 해당 프로젝트에서 작성한 쿼리를 나타내는 코드를 `your-app-name/src/__generated__/` 에 생성한다.

### 4.2. Configure Relay Runtime

컴파일러 설정이 완료되었으니 런타임을 세팅할 수 있는데, 이는 Relay에게 우리의 GraphQL 서버와 어떻게 연결할 것인지에 대해 알려주는 것과 같다.

위의 코드를 동일하게 사용하되, 추가적으로 **Relay Environment** 를 정의한다. 이는 서버 (Relay Network) 에 저장된 캐시를 어떻게 활용할 것인지에 대해 캡슐화하는 것을 의미한다.

```jsx
// your-app-name/src/RelayEnvironment.js
import {Environment, Network, RecordSource, Store} from 'relay-runtime';
import fetchGraphQL from './fetchGraphQL';

// Relay passes a "params" object with the query name and text. So we define a helper function
// to call our fetchGraphQL utility with params.text.
async function fetchRelay(params, variables) {
  console.log(`fetching query ${params.name} with ${JSON.stringify(variables)}`);
  return fetchGraphQL(params.text, variables);
}

// Export a singleton instance of Relay Environment configured with our network function:
export default new Environment({
  network: Network.create(fetchRelay),
  store: new Store(new RecordSource()),
});
```

## Step 5. Fetching a Query With Relay

```jsx
...
import fetchGraphQL from './fetchGraphQL';
import graphql from 'babel-plugin-relay/macro';
import {
  RelayEnvironmentProvider,
  loadQuery,
  usePreloadedQuery,
} from 'react-relay/hooks';
import RelayEnvironment from './RelayEnvironment';

const { Suspense } = React;

// Define a query
const RepositoryNameQuery = graphql`
  query AppRepositoryNameQuery {
    repository(owner: "facebook", name: "relay") {
      name
    }
  }
`;

// 앱이 시작하자마자 쿼리를 즉시 로드한다.
// 실제 앱에서는 라우팅 configuration에 이를 설정하고, 새로운 route로 이동 시 데이터를 프리-로드한다.
const preloadedQuery = loadQuery(RelayEnvironment, RepositoryNameQuery, {
  /* query variables */
});

// 프리로드된 쿼리를 읽는 이너 컴포넌트는 `usePreloadedQuery`를 사용한다.
// - 쿼리가 실행 완료되면, 쿼리의 결과를 리턴한다.
// - 쿼리가 아직 펜딩 중이면, Suspend 한다. 이는 부모 컴포넌트 중 가장 가까이 위치한 fallback에 근거한다.
// - 쿼리가 (데이터 패칭을) 실패하면, 실패 에러를 띄운다.
function App(props) {
  const data = usePreloadedQuery(RepositoryNameQuery, props.preloadedQuery);

  return (
    <div className="App">
      <header className="App-header">
        <p>{data.repository.name}</p>
      </header>
    </div>
  );
}

// 위 App 컴포넌트는 어떻게 Relay Environment에 접근할지에 대한 정보가 있어야 하고,
// Suspend 경우를 위한 fallback을 설정해야 한다.
function AppRoot(props) {
  return (
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <Suspense fallback={'Loading...'}>
        <App preloadedQuery={preloadedQuery} />
      </Suspense>
    </RelayEnvironmentProvider>
  );
}

export default AppRoot;
```

1. RepositoryNameQuery
    - 쿼리를 정의한다.
2. preloadQuery
    - 사전에 정의한 RelayEnvironment와 RepositoryNameQuery, 쿼리 변수(args)를 전달한다.
3. AppRoot
    - `<RelayEnvironmentProvider>` 은 현재 Relay Environment 인스턴스와의 소통 방식을 child 컴포넌트에 전달한다.
    - `<Suspense>` 는 child가 suspend할 경우의 fallback을 지정한다.