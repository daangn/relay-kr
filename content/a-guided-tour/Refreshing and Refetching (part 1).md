# Refreshing Queries

Refreshing Queries (쿼리 새로고침) 은 서버에서 해당 데이터의 최신 버전을 얻기 위해 원래 쿼리에 의해 렌더링된 것과 똑같은 데이터를 가져오는 것입니다.



## real-time features(실시간 기능들) 이용하기 

서버의 최신버전으로 데이터를 최신 상태로 유지 하기위해서 가장 먼저 고려할 사항은 자동으로 데이터를 업데이트시켜주고 주기적으로 새로고침해주는 실시간 기능들을 이용하는 것이 적절한지 여부입니다.

real-time features(실시간 기능들) 에 한 가지 예로는 서버가 클라이언트에게 해당 쿼리의 정보가 바뀔때 마다 알려주는  GQLS(GraphQL Subscriptions) 가 있습니다. - 서버나 네트워크 레이어에 추가적인 설정이 필요함



## `useQueryLoader` / `loadQuery` 를 사용

useQueryLoader 훅을 사용해서 쿼리를 새로고침하기 위해서는 loadQuery 함수만 다시 호출하면 된다.



```tsx
/**
 * App.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

const AppQuery = require('__generated__/AppQuery.graphql');

function App(props: Props) {
  const [queryRef, loadQuery] = useQueryLoader<AppQueryType>(
    AppQuery,
    props.appQueryRef /* initial query ref */
  );

  const refresh = useCallback(() => {
    // Load the query again using the same original variables.
    // Calling loadQuery will update the value of queryRef.
    // The fetchPolicy ensures we always fetch from the server and skip
    // the local data cache.
    const {variables} = props.appQueryRef;
    loadQuery(variables, {fetchPolicy: 'network-only'});
  }, [/* ... */]);

  return (
    <React.Suspense fallback="Loading query...">
      <MainContent
        refresh={refresh}
        queryRef={queryRef}
      />
    </React.Suspense>
  );
}
```



```tsx
/**
 * MainContent.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

// Renders the preloaded query, given the query reference
function MainContent(props) {
  const {refresh, queryRef} = props;
  const data = usePreloadedQuery<AppQueryType>(
    graphql`
      query AppQuery($id: ID!) {
        user(id: $id) {
          name
          friends {
            count
          }
        }
      }
    `,
    queryRef,
  );

  return (
    <>
      <h1>{data.user?.name}</h1>
      <div>Friends count: {data.user.friends?.count}</div>
      <Button
        onClick={() => refresh()}>
        Fetch latest count
      </Button>
    </>
  );
}
```



위 예제를 살펴보면,

- 우리는 loadQuery 함수를 새로고침을 위한 이벤트 핸들러 안에서 호출하기 때문에 네트워크 request 는 즉시 시작되고 업데이트된 queryRef를 usePreloaded를 사용하는 MainContent 컴포넌트에 전달합니다.- 업데이트된 데이터를 렌더링합니다.

- 항상 네트워크에서 가져오고 로컬 데이터 캐시를 건너뛰도록 하기 위해 'network-only' 라는 `fetchPolicy`를 전달 합니다.

- loadQuery 를 호출하는 것은 컴포넌트가 리렌더되면서 렌더링을 막는 usePreloadedQuery 가 발생합니다. 우리는 로딩상태를 표현하기 위해서 Suspense boundary로 MainContent 컴포넌트가 감싸져있는지 살펴봐야합니다. 



### 만약 Suspense 를 피해야한다면

경우에 따라 Suspense 의 fallback 을 보여주지 않고 싶을 때가 있습니다. 이러한 경우에는 로딩상태를 수동으로 추적할수있는 fetchQuery  를 대신 사용할수 있습니다.

> 참고
>
> 동시 렌더링이 지원되는 이후의 React 버전에서는 이 경우에 대해서 지원할 것입니다  Suspending 시에 이미 리렌더링된 내용들이 Suspense fallback 으로 숨겨지는 것을 피하도록 해줄 것입니다.

```tsx
/**
 * App.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

const AppQuery = require('__generated__/AppQuery.graphql');

function App(props: Props) {
  const environment = useRelayEnvironment();
  const [queryRef, loadQuery] = useQueryLoader<AppQueryType>(
    AppQuery,
    props.appQueryRef /* initial query ref */
  );
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = useCallback(() => {
    if (isRefreshing) { return; }
    const {variables} = props.appQueryRef;
    setIsRefreshing(true);

    // fetchQuery will fetch the query and write
    // the data to the Relay store. This will ensure
    // that when we re-render, the data is already
    // cached and we don't suspend
    fetchQuery(environment, AppQuery, variables)
      .subscribe({
        complete: () => {
          setIsRefreshing(false);

          // *After* the query has been fetched, we call
          // loadQuery again to re-render with a new
          // queryRef.
          // At this point the data for the query should
          // be cached, so we use the 'store-only'
          // fetchPolicy to avoid suspending.
          loadQuery(variables, {fetchPolicy: 'store-only'});
        }
        error: () => {
          setIsRefreshing(false);
        }
      });
  }, [/* ... */]);

  return (
    <React.Suspense fallback="Loading query...">
      <MainContent
        isRefreshing={isRefreshing}
        refresh={refresh}
        queryRef={queryRef}
      />
    </React.Suspense>
  );
}
```



위 예제를 살펴보면,

- 우리가 새로고침할때, 이제는 우리의 isRefreshing 로딩 상태를 가지고있습니다. 우리는 이 상태를 사용해서 MainContent 구성 요소 내에서 MainContent를 숨기지 않고 사용 중인 스피너 또는 유사한 로딩 UI를 렌더링 할 수 있습니다.
- 이벤트 핸들러에서 먼저 fetchQuery를 호출하여 쿼리를 가져오고 로컬 릴레이 저장소에 데이터를 씁니다. fetchQuery 네트워크 요청이 완료되면 loadQuery를 호출하여 업데이트된 queryRef를 얻은 다음 usePreloaded로 전달합니다.쿼리는 이전 예제와 마찬가지로 업데이트된 데이터를 렌더링합니다.
- 이때 loadQuery가 호출되면 쿼리에 대한 데이터가 로컬 릴레이 저장소에 이미 캐시되어 있어야 하므로 일시 중단을 방지하고 이미 캐시된 데이터만 읽기 위해 'store-only'의 fetchPolicy를 사용합니다.



## `useLazyLoadQuery` 를 사용

useLazyLoadQuery Hook을 사용하여 쿼리를 새로 고치려면 아래와 같이 수행할 수 있습니다.



```tsx
/**
 * App.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

const AppQuery = require('__generated__/AppQuery.graphql');

function App(props: Props) {
  const variables = {id: '4'};
  const [refreshedQueryOptions, setRefreshedQueryOptions] = useState(null);

  const refresh = useCallback(() => {
    // Trigger a re-render of useLazyLoadQuery with the same variables,
    // but an updated fetchKey and fetchPolicy.
    // The new fetchKey will ensure that the query is fully
    // re-evaluated and refetched.
    // The fetchPolicy ensures that we always fetch from the network
    // and skip the local data cache.
    setRefreshedQueryOptions(prev => ({
      fetchKey: (prev?.fetchKey ?? 0) + 1,
      fetchPolicy: 'network-only',
    }));
  }, [/* ... */]);

  return (
    <React.Suspense fallback="Loading query...">
      <MainContent
        refresh={refresh}
        queryOptions={refreshedQueryOptions ?? {}}
        variables={variables}
      />
    </React.Suspense>
  );
```



```tsx
/**
 * MainContent.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

// Fetches and renders the query, given the fetch options
function MainContent(props) {
  const {refresh, queryOptions, variables} = props;
  const data = useLazyLoadQuery<AppQueryType>(
    graphql`
      query AppQuery($id: ID!) {
        user(id: $id) {
          name
          friends {
            count
          }
        }
      }
    `,
    variables,
    queryOptions,
  );

  return (
    <>
      <h1>{data.user?.name}</h1>
      <div>Friends count: {data.user.friends?.count}</div>
      <Button
        onClick={() => refresh()}>
        Fetch latest count
      </Button>
    </>
  );
}
```



위 예제를 살펴보면,

- 상태에서의 새 옵션을 설정하여 새로 고칠 수 있도록 이벤트 핸들러의 컴포넌트를 업데이트합니다. 이렇게 하면 useLazyLoadQuery를 사용하는 MainContent 컴포넌트가 새 fetchKey 및 fetchPolicy로 다시 렌더링하고 렌더링 시 쿼리를 다시 가져옵니다.

- 업데이트 마다 증가하는 fetchKey 의 새로운 값을 전달합니다. 모든 업데이트에서 LazyLoadQuery를 사용할 새 fetchKey를 전달하면 쿼리가 완전히 재평가되고 다시 호출됩니다.
- 항상 네트워크에서 데이터를 가져오고 로컬데이터 캐시를 건너 뛰기 위해 'network-only' 의 fetchPolicy 를 사용합니다.
- 새로 고침 시 상태 업데이트는 사용 중인 fetchPolicy로 인해 항상 네트워크 요청이 이루어지기 때문에 컴포넌트가 suspend 됩니다.  로딩상태를 표현하기 위해서 Suspense boundary로 MainContent 컴포넌트가 감싸져있는지 살펴봐야합니다. 





### 만약 Suspense 를 피해야한다면

경우에 따라 Suspense 의 fallback 을 보여주지 않고 싶을 때가 있습니다. 이러한 경우에는 로딩상태를 수동으로 추적할수있는 fetchQuery  를 대신 사용할수 있습니다.

> 참고
>
> 동시 렌더링이 지원되는 이후의 React 버전에서는 이 경우에 대해서 지원할 것입니다  Suspending 시에 이미 리렌더링된 내용들이 Suspense fallback 으로 숨겨지는 것을 피하도록 해줄 것입니다.

```js
/**
 * App.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

const AppQuery = require('__generated__/AppQuery.graphql');

function App(props: Props) {
  const variables = {id: '4'}
  const environment = useRelayEnvironment();
  const [refreshedQueryOptions, setRefreshedQueryOptions] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = useCallback(() => {
    if (isRefreshing) { return; }
    setIsRefreshing(true);

    // fetchQuery will fetch the query and write
    // the data to the Relay store. This will ensure
    // that when we re-render, the data is already
    // cached and we don't suspend
    fetchQuery(environment, AppQuery, variables)
      .subscribe({
        complete: () => {
          setIsRefreshing(false);

          // *After* the query has been fetched, we update
          // our state to re-render with the new fetchKey
          // and fetchPolicy.
          // At this point the data for the query should
          // be cached, so we use the 'store-only'
          // fetchPolicy to avoid suspending.
          setRefreshedQueryOptions(prev => ({
            fetchKey: (prev?.fetchKey ?? 0) + 1,
            fetchPolicy: 'store-only',
          }));
        }
        error: () => {
          setIsRefreshing(false);
        }
      });
  }, [/* ... */]);

  return (
    <React.Suspense fallback="Loading query...">
      <MainContent
        isRefreshing={isRefreshing}
        refresh={refresh}
        queryOptions={refreshedQueryOptions ?? {}}
        variables={variables}
      />
    </React.Suspense>
  );
}
```

- 우리가 새로고침할때, 이제는 우리의 isRefreshing 로딩 상태를 가지고있습니다. 우리는 이 상태를 사용해서 MainContent 구성 요소 내에서 MainContent를 숨기지 않고 사용 중인 스피너 또는 유사한 로딩 UI를 렌더링 할 수 있습니다.
- 이벤트 핸들러에서 먼저 fetchQuery를 호출하여 쿼리를 가져오고 로컬 릴레이 저장소에 데이터를 씁니다. fetchQuery 네트워크 요청이 완료되면 상태를 업데이트하여 업데이트된 fetchKey와 fetchPolicy를 다시 렌더한 다음 useLazyLoadQuery로 전달하여 이전 예제와 마찬가지로 업데이트된 데이터를 렌더링합니다.
- 이 시점에서 상태를 업데이트할 때 쿼리에 대한 데이터가 로컬 릴레이 저장소에 이미 캐시되어야 하므로 일시 중단을 피하고 이미 캐시된 데이터만 읽기 위해 'store-only'의 fetchPolicy를 사용합니다.





# Refetching Queries with Different Data

 **"refetching a query"** 는 다시 그 쿼리로 다른 데이터를 요청 하는 것입니다. 예를 들어, 현재 선택한 항목을 변경하거나, 표시되는 항목과 다른 항목 목록을 렌더링하거나, 일반적으로 현재 렌더링된 내용을 새 내용이나 다른 내용으로 변환하기 위한 것일 수 있습니다.



## `useQueryLoader` / `loadQuery` 사용

Refreshing Queries with `useQueryLoader` 와 유사한 방법으로 refetch 를 할 수 있습니다.

```tsx
/**
 * App.react.js
 */
const AppQuery = require('__generated__/AppQuery.graphql');

function App(props: Props) {
  const variables = {id: '4'};
  const [queryRef, loadQuery] = useQueryLoader<AppQueryType>(
    AppQuery,
    props.appQueryRef /* initial query ref */
  );

  const refetch = useCallback(() => {
    // Load the query again using the same original variables.
    // Calling loadQuery will update the value of queryRef.
    loadQuery({id: 'different-id'});
  }, [/* ... */]);

  return (
    <React.Suspense fallback="Loading query...">
      <MainContent
        refetch={refetch}
        queryRef={queryRef}
      />
    </React.Suspense>
  );
}
```



```tsx
/**
 * MainContent.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

// Renders the preloaded query, given the query reference
function MainContent(props) {
  const {refetch, queryRef} = props;
  const data = usePreloadedQuery<AppQueryType>(
    graphql`
      query AppQuery($id: ID!) {
        user(id: $id) {
          name
          friends {
            count
          }
        }
      }
    `,
    queryRef,
  );

  return (
    <>
      <h1>{data.user?.name}</h1>
      <div>Friends count: {data.user?.friends?.count}</div>
      <Button
        onClick={() => refetch()}>
        Fetch latest count
      </Button>
    </>
  );
}
```



위 예제를 살펴보면,

- 우리는 loadQuery 함수를 새로고침을 위한 이벤트 핸들러 안에서 호출하기 때문에 네트워크 request 는 즉시 시작되고 업데이트된 queryRef를 usePreloaded를 사용하는 MainContent 컴포넌트에 전달합니다.- 업데이트된 데이터를 렌더링합니다.

- loadQuery에 fetchPolicy를 전달하지 않고 있습니다. 즉, 'store-or-network'의 기본값을 사용합니다. 로컬 캐시 데이터를 사용할지 여부를 지정하기 위해 다른 정책을 제공할 수 있습니다.
  - store-or-network : 데이터가 릴레이 저장소에 캐시되어있는지 없는지 확인 후 존재하지 않는다면 네트워크 요청을 보내는 fetch Policy

- 네트워크 요청을 보낼 수도 있기 때문에 loadQuery 를 호출하는 것은  렌더링을 막는 usePreloadedQuery 가 발생할 수도 있습니다. 우리는 로딩상태를 표현하기 위해서 Suspense boundary로 MainContent 컴포넌트가 감싸져있는지 살펴봐야합니다. 



### 만약 Suspense 를 피해야한다면

경우에 따라 Suspense 의 fallback 을 보여주지 않고 싶을 때가 있습니다. 이러한 경우에는 로딩상태를 수동으로 추적할수있는 fetchQuery  를 대신 사용할수 있습니다.

> 참고
>
> 동시 렌더링이 지원되는 이후의 React 버전에서는 이 경우에 대해서 지원할 것입니다  Suspending 시에 이미 리렌더링된 내용들이 Suspense fallback 으로 숨겨지는 것을 피하도록 해줄 것입니다.

```tsx
/**
 * App.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

const AppQuery = require('__generated__/AppQuery.graphql');

function App(props: Props) {
  const environment = useRelayEnvironment();
  const [queryRef, loadQuery] = useQueryLoader<AppQueryType>(
    AppQuery,
    props.appQueryRef /* initial query ref */
  );
  const [isRefetching, setIsRefetching] = useState(false)

  const refetch = useCallback(() => {
    if (isRefetching) { return; }
    setIsRefetching(true);

    // fetchQuery will fetch the query and write
    // the data to the Relay store. This will ensure
    // that when we re-render, the data is already
    // cached and we don't suspend
    fetchQuery(environment, AppQuery, variables)
      .subscribe({
        complete: () => {
          setIsRefetching(false);

          // *After* the query has been fetched, we call
          // loadQuery again to re-render with a new
          // queryRef.
          // At this point the data for the query should
          // be cached, so we use the 'store-only'
          // fetchPolicy to avoid suspending.
          loadQuery({id: 'different-id'}, {fetchPolicy: 'store-only'});
        }
        error: () => {
          setIsRefetching(false);
        }
      });
  }, [/* ... */]);

  return (
    <React.Suspense fallback="Loading query...">
      <MainContent
        isRefetching={isRefetching}
        refetch={refetch}
        queryRef={queryRef}
      />
    </React.Suspense>
  );
}
```

- 우리가 새로고침할때, 이제는 우리의 isRefreshing 로딩 상태를 가지고있습니다. 우리는 이 상태를 사용해서 MainContent 구성 요소 내에서 MainContent를 숨기지 않고 사용 중인 스피너 또는 유사한 로딩 UI를 렌더링 할 수 있습니다.
- 이벤트 핸들러에서 먼저 fetchQuery를 호출하여 쿼리를 가져오고 로컬 릴레이 저장소에 데이터를 씁니다. fetchQuery 네트워크 요청이 완료되면 loadQuery를 호출하여 업데이트된 queryRef를 얻은 다음 usePreloaded로 전달합니다.쿼리는 이전 예제와 마찬가지로 업데이트된 데이터를 렌더링합니다.
- 이때 loadQuery가 호출되면 쿼리에 대한 데이터가 로컬 릴레이 저장소에 이미 캐시되어 있어야 하므로 일시 중단을 방지하고 이미 캐시된 데이터만 읽기 위해 'store-only'의 fetchPolicy를 사용합니다.



## `useLazyLoadQuery` 사용

Refreshing Queries with `useLazyLoadQuery` 와 유사한 방법으로 refetch 를 할 수 있습니다.

```tsx
/**
 * App.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

const AppQuery = require('__generated__/AppQuery.graphql');

function App(props: Props) {
  const [queryArgs, setQueryArgs] = useState({
    options: {fetchKey: 0},
    variables: {id: '4'},
  });

  const refetch = useCallback(() => {
    // Trigger a re-render of useLazyLoadQuery with new variables,
    // *and* an updated fetchKey.
    // The new fetchKey will ensure that the query is fully
    // re-evaluated and refetched.
    setQueryArgs(prev => ({
      options: {
        fetchKey: (prev?.options.fetchKey ?? 0) + 1,
      },
      variables: {id: 'different-id'}
    }));
  }, [/* ... */]);

  return (
    <React.Suspense fallback="Loading query...">
      <MainContent
        refetch={refetch}
        queryArgs={queryArgs}
      />
    </React.Suspense>
  );
}
```



```tsx
/**
 * MainContent.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

// Fetches and renders the query, given the fetch options
function MainContent(props) {
  const {refetch, queryArgs} = props;
  const data = useLazyLoadQuery<AppQueryType>(
    graphql`
      query AppQuery($id: ID!) {
        user(id: $id) {
          name
          friends {
            count
          }
        }
      }
    `,
    queryArgs.variables,
    queryArgs.options,
  );

  return (
    <>
      <h1>{data.user?.name}</h1>
      <div>Friends count: {data.user.friends?.count}</div>
      <Button
        onClick={() => refetch()}>
        Fetch latest count
      </Button>
    </>
  );
}
```

- 상태에서의 새 옵션을 설정하여 새로 고칠 수 있도록 이벤트 핸들러의 컴포넌트를 업데이트합니다. 이렇게 하면 useLazyLoadQuery를 사용하는 MainContent 컴포넌트가  새 변수와 fetchKey로 다시 렌더를 수행하고 렌더링 시 쿼리를 다시 가져옵니다.

- 업데이트 마다 증가하는 fetchKey 의 새로운 값을 전달합니다. 모든 업데이트에서 LazyLoadQuery를 사용할 새 fetchKey를 전달하면 쿼리가 완전히 재평가되고 다시 호출됩니다.
- LazyLoadQuery를 사용할  fetchPolicy를 전달하지 않습니다. 즉, 'store-or-network'의 기본값을 사용합니다.
- 새로 고침 시 상태 업데이트는 사용 중인 fetchPolicy로 인해 항상 네트워크 요청이 이루어지기 때문에 컴포넌트가 suspend 됩니다.  로딩상태를 표현하기 위해서 Suspense boundary로 MainContent 컴포넌트가 감싸져있는지 살펴봐야합니다. 





### 만약 Suspense 를 피해야한다면

경우에 따라 Suspense 의 fallback 을 보여주지 않고 싶을 때가 있습니다. 이러한 경우에는 로딩상태를 수동으로 추적할수있는 fetchQuery  를 대신 사용할수 있습니다.

> 참고
>
> 동시 렌더링이 지원되는 이후의 React 버전에서는 이 경우에 대해서 지원할 것입니다  Suspending 시에 이미 리렌더링된 내용들이 Suspense fallback 으로 숨겨지는 것을 피하도록 해줄 것입니다.

```tsx
/**
 * App.react.js
 */
import type {AppQuery as AppQueryType} from 'AppQuery.graphql';

const AppQuery = require('__generated__/AppQuery.graphql');

function App(props: Props) {
  const environment = useRelayEnvironment();
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [queryArgs, setQueryArgs] = useState({
    options: {fetchKey: 0, fetchPolicy: 'store-or-network'},
    variables: {id: '4'},
  });

  const refetch = useCallback(() => {
    if (isRefreshing) { return; }
    setIsRefreshing(true);

    // fetchQuery will fetch the query and write
    // the data to the Relay store. This will ensure
    // that when we re-render, the data is already
    // cached and we don't suspend
    fetchQuery(environment, AppQuery, variables)
      .subscribe({
        complete: () => {
          setIsRefreshing(false);

          // *After* the query has been fetched, we update
          // our state to re-render with the new fetchKey
          // and fetchPolicy.
          // At this point the data for the query should
          // be cached, so we use the 'store-only'
          // fetchPolicy to avoid suspending.
          setQueryArgs(prev => ({
            options: {
              fetchKey: (prev?.options.fetchKey ?? 0) + 1,
              fetchPolicy: 'store-only',
            },
            variables: {id: 'different-id'}
          }));
        },
        error: () => {
          setIsRefreshing(false);
        }
      });
  }, [/* ... */]);

  return (
    <React.Suspense fallback="Loading query...">
      <MainContent
        isRefetching={isRefetching}
        refetch={refetch}
        queryArgs={queryArgs}
      />
    </React.Suspense>
  );
}
```

- 우리가 새로고침할때, 이제는 우리의 isRefreshing 로딩 상태를 가지고있습니다. 우리는 이 상태를 사용해서 MainContent 구성 요소 내에서 MainContent를 숨기지 않고 사용 중인 스피너 또는 유사한 로딩 UI를 렌더링 할 수 있습니다.
- 이벤트 핸들러에서 먼저 fetchQuery를 호출하여 쿼리를 가져오고 로컬 릴레이 저장소에 데이터를 씁니다. fetchQuery 네트워크 요청이 완료되면 상태를 업데이트하여 업데이트된 fetchKey와 fetchPolicy를 다시 렌더한 다음 useLazyLoadQuery로 전달하여 이전 예제와 마찬가지로 업데이트된 데이터를 렌더링합니다.
- 이 시점에서 상태를 업데이트할 때 쿼리에 대한 데이터가 로컬 릴레이 저장소에 이미 캐시되어야 하므로 일시 중단을 피하고 이미 캐시된 데이터만 읽기 위해 'store-only'의 fetchPolicy를 사용합니다.

