# Relay 02/18

# Updating Connections

connection을 렌더링 하려고 할때, 사용자의 동작에 따라 아이템을 connection에 추가하거나 삭제하고 싶을 수도 있다. 이전 Updating Data 섹션에서 Relay는 정규화된 로컬 in-memory 저장소를 갖고 있고, 그 저장소에는 ID로 구분되며 정규화된 GraphQL 데이터가 저장되었다. 

Relay를 통해 mutation, subscription 혹은 로컬 데이터를 업데이트 할 경우엔 무조건 데이터에 접근하고 읽고 쓰는 내용을 포함하는 `updater` 함수를 구현해 제공해야 했다. 레코드가 업데이트될 경우, 업데이트된 데이터에 영향을 받는 컴포넌트들은 전부 이를 알아차려 다시 렌더링된다.

## Connection Records

Relay에서 `@connection` 으로 마킹된 connection 필드는 저장소 내부에 특별한 레코드로서 저장되고, 여태까지 fetch된 모든 데이터들을 저장해둔다. connection으로부터 데이터를 추가하거나 삭제하기 위해서는 connection `key` 를 통해 connection 레코드에 접근해야 하는데, 이 key는 `@connection` 선언을 할 때 제공된다. 특히, `key` 는 `ConnectionHandler` API를 사용할 때  `updater` 함수 내부에서 connection에 접근할 수 있도록 해준다.

예를 들어, 아래의 fragment는 `@connection` 선언이 되어있기 때문에 `updater` 함수 내부에서 connection 레코드에 접근하는 것이 가능하다.

```tsx
const {graphql} = require('react-relay');

const storyFragment = graphql`
  fragment StoryComponent_story on Story {
    comments @connection(key: "StoryComponent_story_comments_connection") {
      nodes {
        body {
          text
        }
      }
    }
  }
`;
```

### Accessing connections using `__id`

connection의 `__id` 필드를 쿼리한 후, 이를 통해 저장소의 레코드에 접근할 수 있다.

```tsx
const fragmentData = useFragment(
  graphql`
    fragment StoryComponent_story on Story {
      comments @connection(key: "StoryComponent_story_comments_connection") {
        # __id 필드를 쿼리한다.
        __id

        # ...
      }
    }
  `,
  props.story,
);

// connection의 레코드 id를 가져온다.
const connectionID = fragmentData?.comments?.__id;
```

이후 `connectionID` 를 통해 저장소의 레코드에 접근할 수 있게 된다.

```tsx
function updater(store: RecordSourceSelectorProxy) {
  // connectionID is passed as input to the mutation/subscription
  const connection = store.get(connectionID);

  // ...
}
```

> 주의 : GraphQL API가 `__id` 필드를 노출시킬 필요는 없다. `__id` 는 Relay가 connection 레코드를 구분하기 위해 자동으로 추가한 것이다.
> 

### Accessing connections using `ConnectionHandler.getConnectionID`

만약 connection을 갖고 있는 부모 레코드의 connection ID에 접근할 수 있다면, `ConnectionHandler.getConnectionID` API를 통해 connection 레코드에 접근할 수 있게 된다.

```tsx
const {ConnectionHandler} = require('relay-runtime');

function updater(store: RecordSourceSelectorProxy) {
  // Get the connection ID
  const connectionID = ConnectionHandler.getConnectionID(
    storyID, // passed as input to the mutation/subscription
    'StoryComponent_story_comments_connection',
  );

  // Get the connection record
  const connectionRecord = store.get(connectionID);

  // ...
}
```

### Accessing connections using `ConnectionHandler.getConnection`

만약 connection을 갖고 있는 부모 레코드에 접근할 수 있다면, `ConnectionHandler.getConnection` API와 그 부모 레코드를 통해 connection 레코드에 접근할 수 있다.

```tsx
const {ConnectionHandler} = require('relay-runtime');

function updater(store: RecordSourceSelectorProxy) {
  // Get parent story record
  // storyID is passed as input to the mutation/subscription
  const storyRecord = store.get(storyID);

  // Get the connection record from the parent
  const connectionRecord = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
  );

  // ...
}
```

## Adding edges

connection에 edge를 추가할 수 있는 몇가지 대안들이 있다.

### Using declarative directives

보통 mutation이나 subscription의 페이로드는 단일 edge나 edge들의 리스트와 함께 서버에서 추가된 새로운 edge들을 노출시킨다. 만약 mutation 혹은 subscription이 response에서 쿼리할 수 있는 edge 혹은 edge들을 노출시킨다면, 새로 생성된 edge를 지정된 connection에 추가하기 위해 `@appendEdge` 혹은 `@prependEdge` 선언을 할 수 있다.

또는 mutation이나 subscription의 페이로드가 하나의 node나 node들의 리스트와 함께 서버에서 필드로 추가된 새로운 노드들을 노출시킬 수도 있다. 위에서 edge를 노출시킨것과 마찬가지로, mutation이나 subscription이 응답에서 새로운 노드나 노드들의 필드를 노출시킨다면 `@appendNode` 혹은 `@prependNode` 선언을 통해 새로 지정된 노드들을 지정된 connection에 추가시킬 수 있다.

이 선언은 `connections` 파라미터를 받는데, 이는 connection ID들을 배열로 갖고 있는 GraphQL 변수이다. Connection ID들은 connection의 `__id` 필드에서 얻어지거나 `ConnectionHandler.getconnectionID` API를 통해 얻을 수 있다.

`@appendEdge` / `@prependEdge`

이 선언들은 하나의 edge 혹은 여러 edge들이 담긴 리스트에서 동작한다. `@prependEdge` 는 선택된 edge들을 각 connection들의 맨 앞에 추가시키고, `@appendEdge` 는 선택된 edge들을 각 connection들의 맨 뒤에 추가시킨다.

- 인자
    - `connections` : connection ID들의 배열.
    - `edgeTypeName` : node를 포함하는 edge의 타입 이름. `ConnectionHandler.createEdge` 의 edge 타입 인자와 동일하다.

```tsx
// Get the connection ID using the `__id` field
const connectionID = fragmentData?.comments?.__id;

// Or get it using `ConnectionHandler.getConnectionID()`
const connectionID = ConnectionHandler.getConnectionID(
  '<story-id>',
  'StoryComponent_story_comments_connection',
);

// ...

// Mutation
commitMutation<AppendCommentMutation>(environment, {
  mutation: graphql`
    mutation AppendCommentMutation(
      # Define a GraphQL variable for the connections array
      $connections: [ID!]!
      $input: CommentCreateInput
    ) {
      commentCreate(input: $input) {
        # Use @appendNode or @prependNode on the node field
        feedbackCommentNode @appendNode(connections: $connections, edgeTypeName: "CommentsEdge") {
          id
        }
      }
    }
  `,
  variables: {
    input,
    // Pass the `connections` array
    connections: [connectionID],
  },
});
```

## Manually adding edges

위의 선언문은 connection에서 항목들을 수동으로 추가 혹은 제거할 필요성을 크게 제거하지만, 섬세한 제어는 불가능하기 때문에 모든 사례를 충족시키지 않을 수도 있다.

connection을 수정하는 updater를 작성하려면 connection 레코드에 대한 접근 권한이 있는지 확인해야 한다. connection 레코드가 있으면 connection에 추가하려는 새 edge에 대한 레코드도 필요하다. 일반적으로 mutation 혹은 subscription의 페이로드에는 추가된 새로운 edge가 포함된다. 그렇지 않으면 처음부터 새 edge를 구성할 수도 있다.

예를 들어 다음 mutation의 response에서 새로 생성된 edge를 쿼리할 수 있다.

```tsx
const {graphql} = require('react-relay');

const createCommentMutation = graphql`
  mutation CreateCommentMutation($input: CommentCreateData!) {
    comment_create(input: $input) {
      comment_edge {
        cursor
        node {
          body {
            text
          }
        }
      }
    }
  }
`;
```

- 새로운 edge를 가져오기 위해 `cursor` 를 가져온다는 점을 주목해야 한다. 무조건 필요한 것은 아니지만 `cursor` 기반의 페이지네이션을 수행할 것이라면 필요하다.

`updater` 내부에서는 Relay의 저장소 API와 mutation 응답을 이용해 edge에 접근할 수 있다.

```tsx
const {ConnectionHandler} = require('relay-runtime');

function updater(store: RecordSourceSelectorProxy) {
  const storyRecord = store.get(storyID);
  const connectionRecord = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
  );

  // Get the payload returned from the server
  const payload = store.getRootField('comment_create');

  // Get the edge inside the payload
  const serverEdge = payload.getLinkedRecord('comment_edge');

  // Build edge for adding to the connection
  const newEdge = ConnectionHandler.buildConnectionEdge(
    store,
    connectionRecord,
    serverEdge,
  );

  // ...
}
```

- mutation 페이로드는 `store.getRootField` 메소드를 통해 읽어와 위 저장소에서 루트 필드로써 사용 가능하다. 이 예시에서는 `comment_create` 를 읽고 있다.
- 위 예시에서는 서버로부터 받아온 받아온 edge에 `ConnectionHandler.buildConectionEdge` 메소드를 이용해 새 edge를 추가했다.

새 edge를 추가하기 위해서 `ConnectionHandler.createEdge` 메소드를 사용할 수 있다.

```tsx
const {ConnectionHandler} = require('relay-runtime');

function updater(store: RecordSourceSelectorProxy) {
  const storyRecord = store.get(storyID);
  const connectionRecord = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
  );

  // Create a new local Comment record
  const id = `client:new_comment:${randomID()}`;
  const newCommentRecord = store.create(id, 'Comment');

  // Create new edge
  const newEdge = ConnectionHandler.createEdge(
    store,
    connectionRecord,
    newCommentRecord,
    'CommentEdge', /* GraphQl Type for edge */
  );

  // ...
}
```

한번 새 edge의 레코드를 얻어온 이후로는 `ConnectionHandler.insertEdgeAfter` 혹은 `ConnectionHandler.insertEdgeBefore` 를 이용해 새 edge를 connection에 추가할 수 있다.

```tsx
const {ConnectionHandler} = require('relay-runtime');

function updater(store: RecordSourceSelectorProxy) {
  const storyRecord = store.get(storyID);
  const connectionRecord = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
  );

  const newEdge = (...);

  // Add edge to the end of the connection
  ConnectionHandler.insertEdgeAfter(
    connectionRecord,
    newEdge,
  );

  // Add edge to the beginning of the connection
  ConnectionHandler.insertEdgeBefore(
    connectionRecord,
    newEdge,
  );
}
```

## Removing edges

### Using the declarative deletion directive

edge를 추가하는것과 유사하게 `@deleteEdge` 선언을 통해 edge를 connection으로부터 제거할 수 있다. mutation이나 subscription이 response에서 쿼리할 수 있는 삭제된 노드의 ID가 있는 필드를 노출하는 경우 `@deleteEdge` 지시문을 이용해 connection에서 각 edge를 삭제할 수 있다.

`@deleteEdge`

`ID` 혹은 `[ID]` 를 반환하는 GraphQL 필드에서 사용이 가능하다. 동일한 `id` 를 가진 에지를 포함하는 노드들을 `connections` 배열에서 삭제한다.

- 인자
    - `connections` : connection ID들의 배열

```tsx
// Get the connection ID using the `__id` field
const connectionID = fragmentData?.comments?.__id;

// Or get it using `ConnectionHandler.getConnectionID()`
const connectionID = ConnectionHandler.getConnectionID(
  '<story-id>',
  'StoryComponent_story_comments_connection',
);

// ...

// Mutation
commitMutation<DeleteCommentsMutation>(environment, {
  mutation: graphql`
    mutation DeleteCommentsMutation(
      # Define a GraphQL variable for the connections array
      $connections: [ID!]!
      $input: CommentsDeleteInput
    ) {
      commentsDelete(input: $input) {
        deletedCommentIds @deleteEdge(connections: $connections)
      }
    }
  `,
  variables: {
    input,
    // Pass the `connections` array
    connections: [connectionID],
  },
});
```

## Manually removing edges

`ConnectionHandler` 는 `ConnectionHandler.deleteNode` 메소드를 통해 connection으로부터의 edge 삭제를 지원한다.

```tsx
const {ConnectionHandler} = require('RelayModern');

function updater(store: RecordSourceSelectorProxy) {
  const storyRecord = store.get(storyID);
  const connectionRecord = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
  );

  // Remove edge from the connection, given the ID of the node
  ConnectionHandler.deleteNode(
    connectionRecord,
    commentIDToDelete,
  );
}
```

- 여기서 `ConnectionHandler.deleteNode` 는 주어진 `node` 의 ID를 통해 edge를 삭제한다. 즉, 어떤 node가 주어진 id에 해당하는 edge를 갖고 있는지를 훑어보고, 그 edge를 삭제한다.

## Connection identity with filters

connection을 선언할 때 filter 인자를 전달하면 filter에 사용된 값들은 connection 식별자의 일부가 된다. 즉, Relay 저장소에서 connection을 식별하기 위한 값으로 사용된다.

아래 예시에서 `comments` 필드가 다음과 같은 인자를 받는다고 하자.

```tsx
const {graphql} = require('RelayModern');

const storyFragment = graphql`
  fragment StoryComponent_story on Story {
    comments(
      order_by: $orderBy,
      filter_mode: $filterMode,
      language: $language,
    ) @connection(key: "StoryComponent_story_comments_connection") {
      edges {
        nodes {
          body {
            text
          }
        }
      }
    }
  }
`;
```

`comments` 필드는 `$orderBy`, `$filterMode`, `$language` 를 인자로 받으며 `comments` 를 쿼리할 때 식별자로서 동작한다.  이후 connection 레코드에 접근하기 위해서는 위 값들을 넘겨주어야 한다.

같은 이유로 `ConnectionHandler.getConnection` 메소드를 이용할 때도 세번째 인자로 위 값들을 넘겨주어야 한다.

```tsx
const {ConnectionHandler} = require('RelayModern');

function updater(store: RecordSourceSelectorProxy) {
  const storyRecord = store.get(storyID);

  // Get the connection instance for the connection with comments sorted
  // by the date they were added
  const connectionRecordSortedByDate = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
    {order_by: '*DATE_ADDED*', filter_mode: null, language: null}
  );

  // Get the connection instance for the connection that only contains
  // comments made by friends
  const connectionRecordFriendsOnly = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
    {order_by: null, filter_mode: '*FRIENDS_ONLY*', langugage: null}
  );
}
```

인자로 넘겨준 각 변수들의 조합이 필터로 작용해 다른 레코드를 리턴한다는 것을 암시한다.

connection을 업데이트 하려고 할 경우 그 업데이트에 영향을 받는 모든 레코드들을 업데이트 해야 한다. 예를 들어, 새 댓글을 하나 추가하려 할 경우 사용자의 친구로부터 만들어진 댓글이 아니라면 `FRIENDS_ONLY` connection에 댓글이 추가 되어서는 안된다.

```tsx
const {ConnectionHandler} = require('relay-runtime');

function updater(store: RecordSourceSelectorProxy) {
  const storyRecord = store.get(storyID);

  // Get the connection instance for the connection with comments sorted
  // by the date they were added
  const connectionRecordSortedByDate = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
    {order_by: '*DATE_ADDED*', filter_mode: null, language: null}
  );

  // Get the connection instance for the connection that only contains
  // comments made by friends
  const connectionRecordFriendsOnly = ConnectionHandler.getConnection(
    storyRecord,
    'StoryComponent_story_comments_connection',
    {order_by: null, filter_mode: '*FRIENDS_ONLY*', language: null}
  );

  const newComment = (...);
  const newEdge = (...);

  ConnectionHandler.insertEdgeAfter(
    connectionRecordSortedByDate,
    newEdge,
  );

  if (isMadeByFriend(storyRecord, newComment) {
    // Only add new comment to friends-only connection if the comment
    // was made by a friend
    ConnectionHandler.insertEdgeAfter(
      connectionRecordFriendsOnly,
      newEdge,
    );
  }
}
```

여러 필터들을 이용해 connection들을 관리한다. 그치만 단순히 몇개의 필터 조합만으로 복잡도가 크게 증가하는 문제점이 있다.

이를 해결하기 위해 Relay는 두가지 전략을 사용한다.

1. 어떤 필터가 connection 식별자로 사용되는지 정확하게 특정한다.
    - 페이지네이션에 쓰이는 필터만 `@connection` 선언을 내부에서 사용한다.
    
    ```tsx
    const {graphql} = require('relay-runtime');
    
    const storyFragment = graphql`
      fragment StoryComponent_story on Story {
        comments(
          order_by: $orderBy
          filter_mode: $filterMode
          language: $language
        )
          @connection(
            key: "StoryComponent_story_comments_connection"
            filters: ["order_by", "filter_mode"]
          ) {
          edges {
            nodes {
              body {
                text
              }
            }
          }
        }
      }
    `;
    ```
    
    - language는 페이지네이션에 사용되는 필터가 아니기 때문에 `@connection` 내부에 넣어주지 않았다.
    - 개념적으로는 어떤 인자만 서버로부터 받아온 connection의 결과에 영향을 미치는지 정해준 것이다. 만약 어떤 인자가 서버로부터 받아온 connection의 결과나 정렬방식에 영향을 주지 않는다면 빼도 괜찮은 인자라는 뜻이다. 위 예시에서는 `language` 가 그렇다.
    - 앱이 실행됨에 있어 어떤 부분도 변경하지 않는 인자가 있다면 필터에서 지워도 안전하다는 뜻이 된다.
2. 더 쉬운 대안은 아직 존재하지 않는다.

# Advanced Pagination

이번 섹션에서는 `usePaginationFragment` 를 이용한 고급 페이지네이션 구현 방법들을 알아본다.

## Pagination Over Multiple Connections

같은 컴포넌트에서 여러개의 connection들을 이용해 페이지네이션 하기 위해서는 `usePaginationFragment` 를 여러번 사용하면 된다.

```tsx
import type {CombinedFriendsListComponent_user$key} from 'CombinedFriendsListComponent_user.graphql';
import type {CombinedFriendsListComponent_viewer$key} from 'CombinedFriendsListComponent_viewer.graphql';

const React = require('React');

const {graphql, usePaginationFragment} = require('react-relay');

type Props = {
  user: CombinedFriendsListComponent_user$key,
  viewer: CombinedFriendsListComponent_viewer$key,
};

function CombinedFriendsListComponent(props: Props) {

  const {data: userData, ...userPagination} = usePaginationFragment(
    graphql`
      fragment CombinedFriendsListComponent_user on User {
        name
        friends
          @connection(
            key: "CombinedFriendsListComponent_user_friends_connection"
          ) {
          edges {
            node {
              name
              age
            }
          }
        }
      }
    `,
    props.user,
  );

  const {data: viewerData, ...viewerPagination} = usePaginationFragment(
    graphql`
      fragment CombinedFriendsListComponent_user on Viewer {
        actor {
          ... on User {
            name
            friends
              @connection(
                key: "CombinedFriendsListComponent_viewer_friends_connection"
              ) {
              edges {
                node {
                  name
                  age
                }
              }
            }
          }
        }
      }
    `,
    props.viewer,
  );

  return (...);
}
```

이렇게 하면 되기는 하지만 Relay에서는 하나의 컴포넌트당 하나의 connection을 이용하는 것을 추천한다.

## Bi-directional Pagination

Pagination 섹션에서 어떻게 `usePaginationFragment` 를 사용해 일방적인 방향(forward)의 페이지네이션을 하는지 알아보았다. 하지만 connection은 역방향(backward) 페이지네이션도 지원한다. forward와 backward는 connection의 내용이 어떻게 정렬되는지를 의미한다. 예를 들자면 “forward”는 최신순, “backward”는 오래된 순이 될 것이다.

방향의 의미와는 별개로, Relay는 `usePaginationFragment` 를 이용해 역방향 페이지네이션을 위한 API를 별도로 지원하기도 한다. `before`, `last` 는 `after`, `first` 와 함께 사용된다.

```tsx
import type {FriendsListComponent_user$key} from 'FriendsListComponent_user.graphql';

const React = require('React');
const {Suspense} = require('React');

const {graphql, usePaginationFragment} = require('react-relay');

type Props = {
  userRef: FriendsListComponent_user$key,
};

function FriendsListComponent(props: Props) {
  const {
    data,
    loadPrevious,
    hasPrevious,
    // ... forward pagination values
  } = usePaginationFragment(
    graphql`
      fragment FriendsListComponent_user on User {
        name
        friends(after: $after, before: $before, first: $first, last: $last)
          @connection(key: "FriendsListComponent_user_friends_connection") {
          edges {
            node {
              name
              age
            }
          }
        }
      }
    `,
    userRef,
  );

  return (
    <>
      <h1>Friends of {data.name}:</h1>
      <List items={data.friends?.edges.map(edge => edge.node)}>
        {node => {
          return (
            <div>
              {node.name} - {node.age}
            </div>
          );
        }}
      </List>

      {hasPrevious ? (
        <Button onClick={() => loadPrevious(10)}>
          Load more friends
        </Button>
      ) : null}

      {/* Forward pagination controls can go simultaneously here */}
    </>
  );
}
```

- 단순히 명명하는 방식만 다른것이고 “forward”, “backward”가 의미하는 바는 after, first를 이용한 방식과 완전히 같다.
- “forward”, “backward”를 사용하는 페이지네이션의 전제는 `usePaginationFragment` 를 한 번만 호출하는 것이다. 따라서 동일한 컴포넌트 내에서 “forward”와 “backaward”는 동시에 수행될 수 있다.

## Custom Connection State

기본적으로 `usePaginationFragment` 와 `@connection` 을 사용할 때, Relay는 “forward”인 경우 새로운 페이지를 connection에 뒤에 추가하고, “backward”인 경우 새 페이지를 앞에 추가한다. 즉, 컴포넌트는 항상 페이지네이션을 통해 축적된 모든 데이터와, mutation이나 subscription을 통해 추가되거나 수정된 결과로서의  connection을 렌더링한다.

그러나, 페이지네이션 결과를 병합하고 축적시킬 때 다르게 동작하는 것을 바랄 수도 있고, 로컬 컴포넌트의 상태를 connection에 반영시키고 싶을 수도 있다.

- connection의 visible slice나 window가 달라지는 것을 추적하려 할 때
- 시각적으로 페이지를 분리하려 할 때. 이 때는 각 페이지에 정확히 어떤 아이템들이 들어가야 하는지에 대한 지식이 필요하다.
- 동일한 connection의 서로 다른 “끝"(마지막 노드)을 표시하면서 그들 사이의 gap을 추적하고, gap 사이의 페이지네이션을 수행할 때 결과를 병합할 수 있다.
    - 예를 들어, 가장 오래된 댓글이 맨 위에 표시되는 댓글 목록을 렌더링하려 하고, 다음 페이지를 매기기 위해서는 상호작용 할 수 있는 gap이 필요하다.

이런 복잡한 사용사례들을 해결하기 위해 Relay에서는 개발이 계속 진행중이다.

## Refreshing connections

## Prefetching pages of a Connection

## Rendering One Page of Items at a Time