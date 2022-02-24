# Updating Data

# Introduction

Relay 는 정규화된 GraphQL 데이터의 로컬 인메모리 store 를 보유해요. 

이 store 는 어플리케이션 전반의 GraphQL query 를 수행할 때 데이터를 축적해요. 

GraphQL 데이터의 로컬 데이터베이스라고 생각하면 돼요. 

레코드를 업데이트 했을 때, 업데이트한 데이터의 영향을 받는 모든 컴포넌트에 전파하여 업데이트한 데이터와 함께 re-render 를 수행해요.

이 섹션에서는 서버에서 데이터를 업데이트 한 뒤, 뒤이어 로컬 데이터 저장소를 업데이트하여 컴포넌트가 최신 데이터와 동기화를 유지하는 방법에 대해 설명할 예정이에요.

# GraphQL Mutations

GraphQL 에서는 [GraphQL Mutation](https://graphql.org/learn/queries/#mutations) 을 이용하여 서버 데이터를 업데이트해요.

Mutations 는 서버에서 읽기-쓰기(read-write) 작업을 수행해요. Mutations 는 Back-end 에서 데이터를 수정하면서, 수정한 데이터를 동일 request 에서 query 하기 때문이에요.

## Mutation 작성하기

GraphQL Mutation 은 query 작업과 아주 유사해요. `mutation` 키워드를 사용한다는 점을 제외하면요.

```graphql
mutation FeedbackLikeMutation($input: FeedbackLikeData!) {
  feedback_like(data: $input) {
    feedback {
      id
      viewer_does_like
      like_count
    }
  }
}
```

- 예시의 mutation 은 특정 `Feedback` 오브젝트의 like 데이터를 수정해요. `feedback_like` 는 mutation root field(또는 mutation field) 에요. 이 mutation field 는 특정 data 를 입력받고 Back-end 에서 관련 데이터를 서버에서 업데이트 해요.
- mutation 은 서로 분리된 두 단계로 나뉘어요. 먼저 서버에서 데이터를 업데이트해요. 그 후 query 를 수행해요. 이것으로 mutation response 부분만 업데이트한 데이터만 볼 수 있게 해줘요.
- mutation field (예제에서는 `feedback_like`) 는 특정 GraphQL 타입을 반환해요. 이 GraphQL 타입은, mutation response 으로 query 할 수 있는 데이터를 노출시켜요. 
- mutation field 에서 접근할 수 있는 field 들은 기본 query 에서 자동으로 접근할 수 있는 field 와 동일하지 않아요. 이것은 mutation response 의 일부로 업데이트한 모든 entities 와 `viewer` 오브젝트를 포함하는 best practice 에요. 
- 예제에서는, `like_count` 와 현재 화면을 보고 있는 사용자가 feedback object 를 좋아요 했는지를 나타내는 `viewer_does_like` 값을 업데이트한 feedback 오브젝트를 query 해요.

위 mutation 예시에 대한 성공적인 response 는 다음과 같아요.

```graphql
{
  "feedback_like": {
    "feedback": {
      "id": "feedback-id",
      "viewer_does_like": true,
      "like_count": 1,
    }
  }
}
```

Relay 에서는 `graphql` 키워드를 사용해서 GraphQL mutations 를 선언할 수 있어요.

```javascript
const {graphql} = require('react-relay');

const feedbackLikeMutation = graphql`
  mutation FeedbackLikeMutation($input: FeedbackLikeData!) {
    feedback_like(data: $input) {
      feedback {
        id
        viewer_does_like
        like_count
      }
    }
  }
`;
```

mutations 은 query 나 fragment 를 수행했던 방식으로 [GraphQL 변수](https://daangn-2.gitbook.io/relay-kr/variables) 를 참조한다는 점을 알아두어요.

Relay 에서는 서버에 mutation 을 수행하기 위해, `commitMutation` 와 [useMutation](https://relay.dev/docs/api-reference/use-mutation/) API 를 사용할 수 있어요.

아래는 `commitMutation` API 를 사용한 예제에요. 

```typescript
import type {Environment} from 'react-relay';
import type {FeedbackLikeData, FeedbackLikeMutation} from 'FeedbackLikeMutation.graphql';

const {commitMutation, graphql} = require('react-relay');

function commitFeedbackLikeMutation(
  environment: Environment,
  input: FeedbackLikeData,
) {
  return commitMutation<FeedbackLikeMutation>(environment, {
    mutation: graphql`
      mutation FeedbackLikeMutation($input: FeedbackLikeData!) {
        feedback_like(data: $input) {
          feedback {
            id
            viewer_does_like
            like_count
          }
        }
      }
    `,
    variables: {input},
    onCompleted: response => {} /* Mutation 성공시 */,
    onError: error => {} /* Mutation 예외 발생시 */,
  });
}

module.exports = {commit: commitFeedbackLikeMutation};
```

위 예제가 어떻게 작동하는지 자세히 확인해볼게요.

- `commitMutation` 은 첫번째 인자로 environment 를 받아요. 두번째 인자에서는 `graphql` 키워드로 mutation 을 표현하고, 서버에서 mutation 요청을 보내기 위해 variables 를 표시해요.
- `input` 은 `FeedbackLikeMutation.graphql` 모듈을 이용해  auto-gen 된 Flow 타입이 될 수 있어요. Relay 는 기본적으로 빌드시점에 mutation 을 위한 Flow 타입을 제네레이트 해요. 제네레이트 결과로 나온 Flow 타입은 `*<mutation_name>*.graphql.js` 형태를 띄어요.
- `variables` 과 `onCompleted` 의 `response` 매개변수, `optimisticResponse` 는 개별로 auto-gen 된 타입으로 타이핑되어요. `FeedbackLikeMutation.graphql` 모듈을 통해 `FeedbackLikeMutation` 타입으로 타이핑 된 것처럼.
- `optimisticResponse` 필드를 강타입으로 타이핑하기 위해 mutation query root 에 `@raw_response_type` directive 를 추가해야 해요.
- `commitMutation` 는 다음 두 콜백을 가져요. 요청을 성공적으로 완료한 경우 호출하는 `onCompletd` 와  에러가 발생했을 때 호출하는 `onError`.
- mutation response 를 받으면, local store 에서 같은 `id` field 를 가진 레코드를 찾아 이 레코드를 mutation 응답의 새로운 field 로 자동으로 업데이트해요. 
    - 예제에서는, local store 에 이미 존재하는 `Feedback` 오브젝트 중에서 mutation 응답으로 받은 id 와 매칭하는 `Feedback` 오브젝트를 찾아요. 그리고 이 매칭하는 `Feedback` 오브젝트에서 `viewer_does_like` 와 `like_count` 필드를 업데이트해요.
- mutation response 를 통해 local store 의 데이터를 업데이트하면, 이 데이터를 구독하는 컴포넌트에 데이터 변화를 전파하고 re-render 를 발생시켜요.

## 요청이 성공했을 때의 데이터 업데이트

요청이 성공했을 때 store 데이터를 업데이트하는 방법으로 다음 네 가지가 있어요.

- 내부 mutation field 로 id field 를 가지고 field 를 query 하면, local store 의 레코드는 mutation response 의 새로운 값으로 자동 업데이트해요. 위 예제에서는, query 가 `feedback` 과 `id` field 를 가지고 있기 때문에, Relay 는 local store 에서 이 id field 와 매칭한 `Feedback` 을 찾아요. 그리고 `Feedback` 오브젝트에서 `viewer_does_like` 와 `like_count` field 를 업데이트해요.
    - mutation 을 완료한 후, fragment 를 refetch 하는 대신, mutation response 를 가지고 fragment 을 spread 해요. 이 방법은 동일 요청에서 fragment 데이터를 업데이트하는 방법이에요.
- 내부 mutation field 로 id field 와 `@deleteRecord` directive 를 가지고 있으면, local store 에서 해당 field 를 삭제해요.
- 내부 mutation field 로 `@prepandEdge` 나 `@appendEdge` directive 를 가지고 edge field 를 query 하면, connection 에서 edge 를 prepend 하거나 append 해요. 
- 위 세 가지에 해당하지 않으면, mutation 요청이 성공했을 때 local store 의 데이터를 어떻게 update 할지는 updater 콜백으로 설정할 수 있어요.

지금까지 local store 의 데이터를 업데이트하는 방법을 개별 시나리오로만 표현했어요. 그런데 둘 이상의 방법으로 local store 데이터를 업데이트하는 경우, relay 가 어떤 순서로 데이터를 업데이트하는지 아래에 `updater 함수들의 실행 순서` 에서 자세히 확인할 수 있어요.

## Updater 함수

단순히 필드값을 업데이트하거나 mutation directive 를 선언하는 것만으로는 부족해서 좀 더 복잡한 작업을 진행해서 업데이트하길 원한다면 `commitMutation` 이나 `useMutation` 에 `updater` 함수를 선언해서 store 업데이트하는 것을 전부 관리할 수 있어요.

```typescript
import type {Environment} from 'react-relay';
import type {CommentCreateData, CreateCommentMutation} from 'CreateCommentMutation.graphql';

const {commitMutation, graphql} = require('react-relay');
const {ConnectionHandler} = require('relay-runtime');

function commitCommentCreateMutation(
  environment: Environment,
  feedbackID: string,
  input: CommentCreateData,
) {
  return commitMutation<CreateCommentMutation>(environment, {
    mutation: graphql`
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
    `,
    variables: {input},
    onCompleted: () => {},
    onError: error => {},
    updater: store => {
      const feedbackRecord = store.get(feedbackID);

      // record 를 구해요
      const connectionRecord = ConnectionHandler.getConnection(
        feedbackRecord,
        'CommentsComponent_comments_connection',
      );

      // 서버 응답에서 payload 를 구해요
      const payload = store.getRootField('comment_create');

      // payload 에서 edge 값을 구해요
      const serverEdge = payload.getLinkedRecord('comment_edge');

      // connection 에 추가하기 위한 edge 를 생성해요
      const newEdge = ConnectionHandler.buildConnectionEdge(
        store,
        connectionRecord,
        serverEdge,
      );

      // connection 끝에 edge 를 추가해요
      ConnectionHandler.insertEdgeAfter(
        connectionRecord,
        newEdge,
      );
    },
  });
}
module.exports = {commit: commitCommentCreateMutation};
```

예제에 대해 자세히 살펴볼게요.

- `updater` 함수는 `RecordSourceSelectorProxy` 의 인스턴스인 store 를 첫번째 인자로 받아요. 이 interface 는 절차적으로 Relay store 의 데이터를 읽고 작성해요. 이것은 mutation response 의 응답에 store 를 업데이트 하는 방식을 개발자가 전부 제어할 수 있음을 의미해요. 개발자는 새로운 record 를 전적으로 생성할 수도 있고, 기존 record 를 업데이트하거나 삭제할 수 있어요.
  - `updater` 함수는 두번째 인자로 `payload` 를 받아요.  `paylod` 인자는 mutation response 오브젝트에요. `payload` 인자를 통해서 store 에 접근하지 않아도 mutation response 로 받은 payload data 를 읽을 수 있어요.
- 예제를 볼게요. 서버에 comment 를 성공적으로 추가한 이후, local store 에 새로운 comment 를 추가했어요. 더 자세히 이야기하자면. connection 에 새로운 item 을 추가하는 거에요. connection 에서 item 을 추가하거나 삭제하는 방법에 대해 좀 더 자세히 알고 싶다면 이 [섹션](https://daangn-2.gitbook.io/relay-kr/rendering-list-data-and-pagination-part-2#updating-connections) 을 참고해주세요.
  - 사실 위의 예제에서는 굳이 `updater` 함수를 사용하지 않아도 괜찮아요! 예제 상황에서는 `@appendEdge` directive 를 사용하는 것이 best practice 에요.
- mutation response 는 `store` 로부터 접근 가능한 root field record 라는 점을 기억하세요. `store.getRootField` API 를 사용해서 접근할 수 있어요. 예제에서는 mutation response root field 인 `comment_create` root field 에 접근하고 있어요.
- mutation 의 `root` field 는 query 의 `root` field 와 구분해서 생각해야 돼요. mutation updater 의 `store.getRootField` 는 mutation response 의 record 에요. mutation response 뿐만이 아닌 전체 root 에서 record 에 접근하고 싶다면 `store.getRoot().getLinkedRecord` 를 대신 사용해요.
- mutation 의 `updater` 함수를 통해 local store 의 데이터를 업데이트하면, 이 데이터를 구독하는 컴포넌트에 데이터 변화를 전파하고 re-render 를 발생시켜요.

## 낙관적(optimistic) update

사용자 인터렉션에 응답하기 전에 먼저 서버 응답부터 기다려야 하는 것을 피하고 싶을 수 있어요. 예를 들어 사용자가 "좋아요" 버튼을 클릭하면, 해당 포스트에 "좋아요" 를 했다고 바로 보여주는 거에요. 서버로부터 mutation response 를 아직 받지 않았는데도요. 이번 섹션에서 곧 어떻게 이것을 구현할 수 있는지 다룰거에요.

더 일반적인 상황에 맞추어 설명해볼게요. 인지 반응성(perceived responsiveness) 를 향상시키기 위해 local 데이터를 낙관적으로 즉시 업데이트 하고 싶은 상황이에요. 즉 mutation 이 성공하면 바로 반영하리라 생각하는 것을 local data 에 즉시 업데이트하고 싶은 거에요.

물론 mutation 이 실패하면 에러 메시지를 보여주면서 롤백 할 수 있어요. 하지만 대부분의 mutation 은 성공할 것이라고 낙관적으로 기대한다는 점을 떠올려봐요.

이 낙관적 업데이트를 구현하기 위해 Relay 는 mutation 을 실행하면서 낙관적 업데이트를 진행할 수 있도록 두 개의 API 를 제공해요.

## 낙관적 응답(Optimistic Response)

mutation 에 대한 서버 응답이 올 것을 예상하고 store 에 낙관적 업데이트를 먼저 진행하기 위한 가장 간단한 방법이 있어요. 바로 `commitMutation` 에 `optimisticResponse` 를 선언하는 거에요.

```typescript
import type {Environment} from 'react-relay';
import type {FeedbackLikeData, FeedbackLikeMutation} from 'FeedbackLikeMutation.graphql';

const {commitMutation, graphql} = require('react-relay');

function commitFeedbackLikeMutation(
  environment: Environment,
  feedbackID: string,
  input: FeedbackLikeData,
) {
  return commitMutation<FeedbackLikeMutation>(environment, {
    mutation: graphql`
      mutation FeedbackLikeMutation($input: FeedbackLikeData!)
        @raw_response_type {
        feedback_like(data: $input) {
          feedback {
            id
            viewer_does_like
          }
        }
      }
    `,
    variables: {input},
    optimisticResponse: {
      feedback_like: {
        feedback: {
          id: feedbackID,
          viewer_does_like: true,
        },
      },
    },
    onCompleted: () => {} /* Mutation 성공 */,
    onError: error => {} /* Mutation 실패 */,
  });
}

module.exports = {commit: commitFeedbackLikeMutation};
```

예제에서 어떤 일이 발생하는지 알아볼까요?

- `optimisticResponse` 는 mutation response 형태와 동일한 형태를 가진 오브젝트에요. `optimisticResponse` 는 서버로부터 성공적인 응답이 왔다고 시뮬레이트해요. `optimisticResponse` 을 선언했다면 Relay 는 서버 응답을 처리하는 것과 동일한 방식으로 `optimisticResponse` 응답을 처리해요. 그 후 `optimisticResponse` 응답에 따라 데이터를 업데이트해요.
  - 예제를 더 살펴볼게요. 주어진 feedbackId 와 일치하는 `feedback` 을 찾아서 record 를 업데이트 할 거에요. `Feedback` 오브젝트에서 `viewer_does_lik` 를 즉시 `true` 로 변경하고, 이 데이터의 변경을 곧바로 UI 화면에 반영할 거에요.
- mutation 이 성공적으로 응답한다면, 방금 진행했던 낙관적 업데이트를 롤백하면서 서버 응답으로 대체해요.
- mutaiton 이 실패한 경우, 낙관적 업데이트를 롤백하고 `onError` 콜백에서 정의한 action (예: 에러 메시지 출력) 을 수행할거에요. 
- GraphQL schema 에 `@raw_response_type` directive 를 선언한 경우 `optimisticResponse` 를 위한 타입을 generate 한다는 점을 기억하세요.

## 낙관적 Updater

하지만 서버 응답이 정적으로 예측 가능한 것이 아닐 수 있어요. 또 좀 더 복잡한 업데이트를 수행하면서 낙관적 업데이트를 수행해야 할 수 있어요. 예를 들어 record 를 삭제한 뒤 새로 생성하거나 connection 에 item 을 추가하거나 삭제하는 것 같은 복잡한 업데이트에 낙관적 업데이트를 적용하고 싶을 수 있어요.

이럴 때에는 `otimisticUpdater` 함수를 `commitMutation` 에 선언해요. 예를 들어볼게요. `optimisticResponse` 대신 `optimisticUpdater` 를 사용하면 `viewer_does_like` 를 true 로 설정한 뒤, `like_count` field 를 증가시킬 수 있어요.

```typescript
import type {Environment} from 'react-relay';
import type {FeedbackLikeData} from 'FeedbackLikeMutation.graphql';

const {commitMutation, graphql} = require('react-relay');

function commitFeedbackLikeMutation(
  environment: Environment,
  feedbackID: string,
  input: FeedbackLikeData,
) {
  return commitMutation(environment, {
    mutation: graphql`
      mutation FeedbackLikeMutation($input: FeedbackLikeData!) {
        feedback_like(data: $input) {
          feedback {
            id
            like_count
            viewer_does_like
          }
        }
      }
    `,
    variables: {input},
    optimisticUpdater: store => {
      // Feedback 오브젝트를 위한 record 를 구해요
      const feedbackRecord = store.get(feedbackID);

      // like_count 의 현재 값을 읽어요.
      const currentLikeCount = feedbackRecord.getValue('like_count');

      // 낙관적으로 like_count 의 값을 1 증가시켜요
      feedbackRecord.setValue((currentLikeCount ?? 0) + 1, 'like_count');

      // 낙관적으로 viewer_does_like 를 true 로 설정해요
      feedbackRecord.setValue(true, 'viewer_does_like');
    },
    onCompleted: () => {} /* Mutation 성공 */,
    onError: error => {} /* Mutation 실패 */,
  });
}

module.exports = {commit: commitFeedbackLikeMutation};
```

예제에 대해 좀 더 자세히 볼게요.

- `optimisticUpdater` 는 일반적인 `updater` 함수와 같은 시그니처를 가지고 동일하게 작동해요. 하지만 `optimisticUpdater` 은 mutation response 를 완료하기 전에 즉시 실행하는 함수라는 점이 큰 차이점이에요.
- 만약 mutation 이 성공한 경우, 낙관적 업데이트를 롤백하고, 서버 응답으로 대체해요.
  - `optimisticResponse` 를 사용했다면 `like_count` 값을 어떤 고정된 값으로 정적으로 업데이트할 수 없어요. 그래서 `like_count` 값을 현재 값에서 1 만큼 증가시키기 위해서는 먼저 store 에서 현재의 `like_count` 값을 알아야 해요. `optimisticUpdater` 를 사용하면 이러한 작업이 가능해요.
  - mutation 을 완료했을 때, 서버에서 받은 값은 낙관적으로 업데이트한 값과 차이를 보일 수 있어요. 예제의 경우, 만약 현재 화면을 보고 있는 사용자가 아닌 다른 누군가가 "좋아요" 를 했다면, 낙관적 업데이트는 1만큼 증가시키지만 실제 서버로부터 데이터를 반영했을 때는 2만큼 증가할 수 있다는 이야기에요.
- mutation 이 실패하면, 낙관적 업데이트는 롤백하고 `onError` 콜백에서 정의한 action 을 수행해요.
- `optimisticUpdater` 와는 별개로 `updater` 함수를 선언하지 않았다면, 서버 응답이 도착하면 기본 작업을 수행해요. 예제에서는 `Feedback` 오브젝트의 `like_count` 와 `viewer_does_like` 값을 업데이트 할거에요.

### 알아두세요

mutation 으로 local store 의 데이터를 업데이트하면, 이 데이터를 구독하는 컴포넌트에 데이터 변화를 전파하고 re-render 를 발생시켜요.

## updater 함수들의 실행 순서

`updater` 함수와 낙관적 업데이트는 아래 순서처럼 작동해요.

- `optimisticResponse` 를 선언했다면, Relay 는 `optimisticResponse` 에서 업데이트해야 하는 record 를 찾아서 새로운 값으로 업데이트해요.
- `optimisticUpdater` 를 선언했다면, Relay 는 `optimisticUpdater` 에서 정의내린 대로 store 를 업데이트해요.
- `optimsiticResponse` 를 선언했다면, 낙관적 업데이트를 진행하면서 `@deleteRecord`, `@appendEdge`, `@prependEdge` mutation directive 를 수행해요.
- 만약 mutation 이 성공했다면 다음 과정을 진행해요.
  - 낙관적 업데이트를 롤백해요.
  - Relay 는 서버 응답에서 업데이트해야 하는 record 를 찾고 새로운 값으로 업데이트해요.
  - `updater` 를 선언했다면, Relay 는 `updater` 함수가 정의내린대로 store 를 업데이트해요. 서버로부터 받은 payload 는 `updater` 함수에서 store 의 root field 로 이용 가능해요.
  - `@deleteRecord`, `@appendEdge`, `@prependEdge` mutation directive 를 수행해요.
- 만약 mutation 이 실패했다면 다음 과정을 진행해요.
  - 낙관적 업데이트를 롤백해요.
  - `onError` 콜백을 호출해요.

## 전체 예제

다음 예제는 사용할 수 있는 모든 옵션들(`optimisticResponse`, `optimisticUpdater`, `updater`) 을 이용해 복잡한 시나리오를 구현한 예제에요. 

새로운 comment 를 추가하는 mutation 을 나타낸 예제에요. (connection 업데이트에 대한 자세한 설명은 [connection 업데이트하기](https://daangn-2.gitbook.io/relay-kr/rendering-list-data-and-pagination-part-2#updating-connections) 를 참고하세요.)

```typescript
import type {Environment} from 'react-relay';
import type {CommentCreateData, CreateCommentMutation} from 'CreateCommentMutation.graphql';

const {commitMutation, graphql} = require('react-relay');
const {ConnectionHandler} = require('relay-runtime');

function commitCommentCreateMutation(
  environment: Environment,
  feedbackID: string,
  input: CommentCreateData,
) {
  return commitMutation<CreateCommentMutation>(environment, {
    mutation: graphql`
      mutation CreateCommentMutation($input: CommentCreateData!) {
        comment_create(input: $input) {
          feedback {
            id
            viewer_has_commented
          }
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
    `,
    variables: {input},
    onCompleted: () => {},
    onError: error => {},

    // 낙관적으로 `viewer_has_commented` 를 업데이트하기 위한 값을 설정해요
    optimisticResponse: {
      feedback: {
        id: feedbackID,
        viewer_has_commented: true,
      },
    },

    // 낙관적으로 comments connection 에 새로운 comment 를 추가해요
    optimisticUpdater: store => {
      const feedbackRecord = store.get(feedbackID);
      const connectionRecord = ConnectionHandler.getConnection(
        userRecord,
        'CommentsComponent_comments_connection',
      );

      // 완전 기초부터 local comment 를 생성해요
      const id = `client:new_comment:${randomID()}`;
      const newCommentRecord = store.create(id, 'Comment');

      // ... content 와 함께 새로운 comment 를 업데이트해요

      // 완전 기초부터 새로운 edge 를 생성해요
      const newEdge = ConnectionHandler.createEdge(
        store,
        connectionRecord,
        newCommentRecord,
        'CommentEdge' /* GraphQl Type for edge */,
      );

      // connection 의 끝에 edge 를 추가해요
      ConnectionHandler.insertEdgeAfter(connectionRecord, newEdge);
    },
    updater: store => {
      const feedbackRecord = store.get(feedbackID);
      const connectionRecord = ConnectionHandler.getConnection(
        userRecord,
        'CommentsComponent_comments_connection',
      );

      // 서버에서 payload 를 받아요
      const payload = store.getRootField('comment_create');

      // server payload 에서 edge 를 읽어요
      const newEdge = payload.getLinkedRecord('comment_edge');

      // connection 의 끝에 edge 를 추가해요
      ConnectionHandler.insertEdgeAfter(connectionRecord, newEdge);
    },
  });
}

module.exports = {commit: commitCommentCreateMutation};
```

`updater` 함수들을 실행하는 순서에 따라 예제를 살펴 볼게요.

- `optimisticResponse` 를 선언했기 때문에 가장 먼저 `optimisticResponse` 를 수행해요. local store 의 `$Feedback` 오브젝트에서 `viewer_has_commented` 필드를 `true` 로 낙관적 업데이트를 진행해요. 
- `optimisticUpdater` 를 선언했기 때문에 이어서 `optimisticUpdater` 을 수행해요. `optimisticUpdater` 는 함수 내부에서 완전히 기초부터 새로운 comment 와 edge record 를 생성해요. 생성을 완료하면 connection 에 새로운 edge 를 추가해요.
- 낙관적 업데이트를 완료하면, 이 데이터들을 구독하고 있는 컴포넌트에 데이터가 변경되었다는 점을 전파해요.
- mutation 이 성공했다면 모든 낙관적 업데이트를 롤백해요.
- Relay 는 서버로부터 응답받은 데이터로 local store 의 `Feedback` 오브젝트에서 `viewer_has_commented` 값을 `true` 로 변경해요.
- 마지막으로, `updater` 함수를 실행해요.  `updater` 함수는 `optimisticUpdater` 함수와 비슷하지만, 새로운 데이터를 완전히 기초부터 생성하지 않고 mutation response 의 payload 에서 새로운 데이터를 읽어온 뒤 그 데이터를 가지고 connection 에 edge 를 추가해요.

## mutation 도중 데이터 무효화  

mutation 과 관련한 모든 데이터를 mutation 과정의 일부로 서버로부터 다시 받아오는 것이 best practice 에요. 이를 통해 Relay local store 는 서버와 동일한 상태를 유지할 수 있어요.

하지만 '사용자 차단' 이나 '그룹 이탈' 과 같이 파급 효과가 큰 mutation 에 영향받는 데이터들을 전부 특정하는 것이 불가능할 때가 있어요.

이와 같은 mutation 상황에서는, 전체 store 나 일부 데이터를 명시적으로 stale 로 표시하여 다음 렌더링 때 Relay 가 re-fetch 하도록 할 수 있어요.

이와 같이 데이터 무효화 API 와 관련한 이야기는 [데이터 섹션의 부패(staleness)](https://daangn-2.gitbook.io/relay-kr/reuse-cached-data-for-rendering#staleness-of-data) 에서 더 자세히 확인할 수 있어요.

## Mutation queueing

TBD

# GraphQL Subscriptions

GraphQL Subscriptions 는 클라이언트가 서버의 데이터 변경을 구독해서 서버 데이터의 변경이 발생할 때마다 이것을 전파받는 메커니즘이다.

GraphQL Subscriptions 는 query 와 유사한 형태를 가지지만 subscription 키워드를 사용한다는 차이점이 있다.

```graphql
subscription FeedbackLikeSubscription($input: FeedbackLikeSubscribeData!) {
  feedback_like_subscribe(data: $input) {
    feedback {
      id
      like_count
    }
  }
}
```

- subscription 을 구독하면 `Feedback` 오브젝트에서 "좋아요" 나 "좋아요" 취소가 발생할 때 클라이언트에게 이러한 데이터 변경 사실을 전달해요. `feedback_like_subscription` field 는 백엔드에서 특정 입력을 받고 구독 설정을 하는 subscription field 그 자체에요.
- `feedback_like_subscription` 는 특정 GraphQL 타입을 반환해요. 이 GraphQL 타입은, subscription payload 으로 query 할 수 있는 데이터를 노출시켜요. 다시 말해, 클라이언트는 서버의 데이터 변경을 전달 받으면서 subscription payload 를 받아요. 예제에서는 업데이트한 `like_count` 상태를 반영한 Feedback 오브젝트를 query 해요. `like_count` 는 실시간으로 좋아요 숫자를 반영해요.

클라이언트가 받은 subscription payload 의 형태는 다음과 같아요.

```json
{
  "feedback_like_subscribe": {
    "feedback": {
      "id": "feedback-id",
      "like_count": 321
    }
  }
}
```

Relay 에서는 `graphql` 키워드를 사용해서 GraphQL subscrition 을 선언할 수 있어요.

```typescript
const {graphql} = require('react-relay');

const feedbackLikeSubscription = graphql`
  subscription FeedbackLikeSubscription($input: FeedbackLikeSubscribeData!) {
    feedback_like_subscribe(data: $input) {
      feedback {
        id
        like_count
      }
    }
  }
`;
```

- subscription 은 query 나 fragment 와 같은 방식으로 GraphQL variables 를 참조할 수 있다는 점을 기억하세요.

서버에서 subscription 을 수행하는 데에는 두 가지 방법이 있어요. `requestSubscription` API 와 hook 을 사용하는 거에요.


## subscription API 요청하기

Relay 가 서버에서 subscription 을 수행하기 위해 `requestSubscription` API 를 사용해요

```typescript
import type {Environment} from 'react-relay';
import type {FeedbackLikeSubscribeData} from 'FeedbackLikeSubscription.graphql';

const {graphql, requestSubscription} = require('react-relay');

function feedbackLikeSubscribe(
  environment: Environment,
  feedbackID: string,
  input: FeedbackLikeSubscribeData,
) {
  return requestSubscription(environment, {
    subscription: graphql`
      subscription FeedbackLikeSubscription(
        $input: FeedbackLikeSubscribeData!
      ) {
        feedback_like_subscribe(data: $input) {
          feedback {
            id
            like_count
          }
        }
      }
    `,
    variables: {input},
    onCompleted: () => {} /* Subscription 완료 */,
    onError: error => {} /* Subscription 에러 */,
    onNext: response => {} /* Subscription payload 구독 */
  });
}

module.exports = {subscribe: feedbackLikeSubscribe};
```

예제를 살펴볼게요

- `requestSubscription` 는 enviroment 인자를 받아요.  `graphql` 키워드로 subscription 을 정의 내릴 수 있고 variables 을 사용할 수 있어요.
- `input` 은 `FeedbackLikeSubscription.graphql` 모듈을 이용해  auto-gen 된 Flow 타입이 될 수 있어요. Relay 는 기본적으로 빌드시점에 mutation 을 위한 Flow 타입을 제네레이트 해요. 제네레이트 결과로 나온 Flow 타입은 `*<subscription_name>*.graphql.js` 형태를 띄어요. 
- `requestSubscription` 에서는 `onCompletd` 와 `onError` 콜백을 선언할 수 있어요. 각각 subscription 을 완료하거나 에러가 발생했을 때 사용해요.
- `requestSubscription` 에서는 `onNext` 콜백을 선언할 수 있어요. subscription payload 가 갱신 될 때마다 호출해요.
- subscription payload 를 받으면 subscription payload 의 오브젝트는 id 를 가지고, local store 에서 id 와 짝이 맞는 record 를 찾아 새로운 field 값으로 업데이트해요. 예제에서는 local store 에서 subscription payload 의 id 와 동일한 id 를 가진 `Feedback` 를 찾아서 `like_count` field 를 업데이트해요.
- subscription 를 통해 local store 의 데이터를 업데이트하면, 이 데이터를 구독하는 컴포넌트에 데이터 변화를 전파하고 re-render 를 발생시켜요.

subscription 의 결과로 local 데이터를 업데이트할 때 단순히 field 를 업데이트하는 것보다 더 복잡한 작업을 수행하고 싶을 수 있어요. 예를 들어 기존 record 를 삭제하고 새로운 record 를 생성하거나 connection 에서 새로운 item 을 추가하고 삭제하는 것과 같은 작업이에요. 이런 복잡한 업데이트를 수행하기 위해 `requestSubscription` 에 `updater` 함수를 선언해서 store 에 대한 업데이트를 전부 제어할 수 있어요.

```typescript
import type {Environment} from 'react-relay';
import type {CommentCreateSubscribeData} from 'CommentCreateSubscription.graphql';

const {graphql, requestSubscription} = require('react-relay');

function commentCreateSubscribe(
  environment: Environment,
  feedbackID: string,
  input: CommentCreateSubscribeData,
) {
  return requestSubscription(environment, {
    subscription: graphql`
      subscription CommentCreateSubscription(
        $input: CommentCreateSubscribeData!
      ) {
        comment_create_subscribe(data: $input) {
          feedback_comment_edge {
            cursor
            node {
              body {
                text
              }
            }
          }
        }
      }
    `,
    variables: {input},
    updater: store => {
      const feedbackRecord = store.get(feedbackID);

      // Get connection record
      const connectionRecord = ConnectionHandler.getConnection(
        feedbackRecord,
        'CommentsComponent_comments_connection',
      );

      // 서버 응답에서 payload 를 구해요
      const payload = store.getRootField('comment_create_subscribe');

      // payload 에서 edge 값을 구해요
      const serverEdge = payload.getLinkedRecord('feedback_comment_edge');

      // connection 에 추가하기 위한 edge 를 생성해요
      const newEdge = ConnectionHandler.buildConnectionEdge(
        store,
        connectionRecord,
        serverEdge,
      );

      // connection 끝에 edge 를 추가해요
      ConnectionHandler.insertEdgeAfter(connectionRecord, newEdge);
    },
    onCompleted: () => {} /* Subscription 완료 */,
    onError: error => {} /* Subscription 실패 */,
    onNext: response => {} /* Subscription payload 구독 */,
  });
}

module.exports = {subscribe: commentCreateSubscribe};
```

예제를 자세히 살펴볼게요
 
- `updater` 함수는 `RecordSourceSelectorProxy` 의 인스턴스인 store 를 첫번째 인자로 받아요. 이 interface 는 절차적으로 Relay store 의 데이터를 읽고 작성해요. 이것은 subscription payload 의 응답에 store 를 업데이트 하는 방식을 개발자가 전부 제어할 수 있음을 의미해요. 개발자는 새로운 record 를 전적으로 생성할 수도 있고, 기존 record 를 업데이트하거나 삭제할 수 있어요. Relay store 가 읽고 쓰는 작업에 대한 전체 API 는 https://facebook.github.io/relay/docs/en/relay-store.html 에서 확인 가능해요.
- 예제를 볼게요. subscription payload 를 받은 뒤 local store 에 새로운 comment 를 추가했어요. 더 자세히 이야기하자면. connection 에 새로운 item 을 추가하는 거에요. connection 에서 item 을 추가하거나 삭제하는 방법에 대해 좀 더 자세히 알고 싶다면 이 [섹션](https://daangn-2.gitbook.io/relay-kr/rendering-list-data-and-pagination-part-2#updating-connections) 을 참고해주세요.
- subscription payload 는 `store` 로부터 접근 가능한 root field record 라는 점을 기억하세요. `store.getRootField` API 를 사용해서 접근할 수 있어요. 예제에서는 subscription response root field 인 `comment_create_subsribe` root field 에 접근하고 있어요.
- `updater` 함수를 통해 local store 의 데이터를 업데이트하면, 이 데이터를 구독하는 컴포넌트에 데이터 변화를 전파하고 re-render 를 발생시켜요.

## hook 을 사용해서 subscription 요청하기

subscription query 를 구독하기 위해 hook 을 사용할 수 있어요.

```typescript
import {graphql, useSubscription} from 'react-relay';
import {useMemo} from 'react';

const subscription = graphql`subscription ...`;
function MyFunctionalComponent({ id }) {
  // 중요: config 는 memoized 된 상태이거나 최소 매 render 때마다 재평가 되지는 않아요.
  // 중요: 그렇게 하지 않으면, usbSubscription 은 너무 자주 re-render 를 발생시킬 수 있어요.
  const config = useMemo(() => { variables: { id }, subscription }, [id]);
  useSubscription(config);
  return <div>Move Fast</div>
}
```
 
이 방법은 `requestSubscription` API 를 간단히 wrapping 한 형태에요. 다음과 같이 작동해요.

- 컴포넌트를 mount 할 때, 주어진 config 를 가지고 subscribe 를 수행해요.
- 컴포넌트를 unmount 할 때, unsubscribe 를 수행해요.

subscription 을 요청하는데 어떤 복잡하고 절차적인 작업을 수행해야 한다면 `requestSubscription` API 를 직접 사용하는 것이 좋아요.

## Network Layer 설정하기

subscription 을 다루기 위해 [Network layer](https://relay.dev/docs/guides/network-layer/) 를 설정할 수 있어요.

기본적으로 GraphQL subscription 은 [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) 을 통해 통신해요. 다음은 [graphql-ws](https://github.com/enisdenjo/graphql-ws) 를 사용한 예제애요.

```typescript
import {
    ...
    Network,
    Observable
} from 'relay-runtime';
import { createClient } from 'graphql-ws';

const wsClient = createClient({
  url:'ws://localhost:3000',
});

const subscribe = (operation, variables) => {
  return Observable.create((sink) => {
    return wsClient.subscribe(
      {
        operationName: operation.name,
        query: operation.text,
        variables,
      },
      sink,
    );
  });
}
const network = Network.create(fetchQuery, subscribe);
...
```

[`subscriptions-transport-ws`](https://github.com/apollographql/subscriptions-transport-ws) 를 사용한 예제도 있어요.

```typescript
import {
    ...
    Network,
    Observable
} from 'relay-runtime';
import { SubscriptionClient } from 'subscriptions-transport-ws';

...

const subscriptionClient = new SubscriptionClient('ws://localhost:3000', {
    reconnect: true,
});

const subscribe = (request, variables) => {
    const subscribeObservable = subscriptionClient.request({
        query: request.text,
        operationName: request.name,
        variables,
    });
    // 중요: subscriptions-transport-ws observable 타입을 Relay 의 observable 타입으로 변경해요
    return Observable.from(subscribeObservable);
};

const network = Network.create(fetchQuery, subscribe);
...

```

# Local 데이터 업데이트

Relay store 에서 local 데이터만을 업데이트하기 위한 몇 가지 API 들이 있어요. 서버와는 무관하게 업데이트하는 상황 등에 사용할 수 있어요.

local 데이터 업데이트와 관련한 API 는 client-only data 와 서버에 fetch 하여 데이터를 받아오는 일반적인 데이터 업데이트 양쪽 모두 사용이 가능해요.

## commitLocalUpdate

`commitLocalUpdate` API 에 `updater` 콜백을 전달해서 local 데이터를 업데이트 할 수 있어요.

```typescript
import type {Environment} from 'react-relay';

const {commitLocalUpdate, graphql} = require('react-relay');

function commitCommentCreateLocally(
  environment: Environment,
  feedbackID: string,
) {
  return commitLocalUpdate(environment, store => {
    const feedbackRecord = store.get(feedbackID);
    const connectionRecord = ConnectionHandler.getConnection(
      userRecord,
      'CommentsComponent_comments_connection',
    );

    // 완전 기초부터 local Comment 생성
    const id = `client:new_comment:${randomID()}`;
    const newCommentRecord = store.create(id, 'Comment');

    // ... content 를 통해 local Comment 업데이트

    // 완전 기초부터 새로운 edge 생성
    const newEdge = ConnectionHandler.createEdge(
      store,
      connectionRecord,
      newCommentRecord,
      'CommentEdge' /* GraphQl Type for edge */,
    );

    // connect 의 끝에 edge 를 추가한다
    ConnectionHandler.insertEdgeAfter(connectionRecord, newEdge);
  });
}

module.exports = {commit: commitCommentCreateLocally};
```

- `commitLocalUpdate` 는 environment 를 첫번째 인자로 받고, `updater` 콜백 함수를 두번째 인자로 받아요.
  - `updater` 콜백 함수는 `RecordSourceSelectorProxy` 의 인스턴스인 store 를 인자로 받아요. 이 interface 는 절차적으로 Relay store 의 데이터를 읽고 작성해요. 이것은 store 를 업데이트 하는 방식을 개발자가 전부 제어할 수 있음을 의미해요. 개발자는 새로운 record 를 전적으로 생성할 수도 있고, 기존 record 를 업데이트하거나 삭제할 수 있어요. 
- 예제에서는 local store 에 새로운 comment 를 추가해요. 좀 더 구체적으로 설명하면 connection 에 새로운 item 을 추가하는 것으로 볼 수 있어요. connection 에서 item 을 추가하거나 삭제하는 방법에 대해 좀 더 자세히 알고 싶다면 이 [섹션](https://daangn-2.gitbook.io/relay-kr/rendering-list-data-and-pagination-part-2#updating-connections) 을 참고해주세요.
- local store 의 데이터를 업데이트하면, 이 데이터를 구독하는 컴포넌트에 데이터 변화를 전파하고 re-render 를 발생시켜요.

## commitPayload

`commitPayload` 는 `OperationDescriptor` 와 query 에 대한 payload 를 인자로 받고 Relay store 을 업데이트해요.

payload 는 일반적인 상황에서 서버가 query 에 응답하는 것처럼 resolved 되고, 

`JSResource`, `requireDefer` 등으로 전달되는 데이터 기반 종속성(Data Driven Dependencies) 또한 resolve 해요.


```typescript
import type {FooQueryRawResponse} from 'FooQuery.graphql'

const {createOperationDescriptor} = require('relay-runtime');

const operationDescriptor = createOperationDescriptor(FooQuery, {
  id: 'an-id',
  otherVariable: 'value',
});

const payload: FooQueryRawResponse = {
  me: {
    id: '4',
    name: 'Zuck',
    profilePicture: {
      uri: 'https://...',
    },
  },
};

environment.commitPayload(operationDescriptor, payload);
```

- `createOperationDescriptor` 는 query 와 variables 를 인자로 받아 `OperationDescriptor` 를 반환해요.
- `@raw_response_type` directive 를 query 에 추가해서 payload 에 대한 Flow type 를 generate 할 수 있어요.
- local store 의 데이터를 업데이트하면, 이 데이터를 구독하는 컴포넌트에 데이터 변화를 전파하고 re-render 를 발생시켜요.
 
# Client-Only Data

## Client-Only Data (Client Schema Extension)

Relay 는 client schema 확장을 통해, 브라우저와 같은 클라이언트에서 GraphQL schema 를 확장하는 기능을 제공해요. 

이런 기능을 제공하는 건 클라이언트에서만 읽고, 쓰고, 업데이트할 필요가 있는 데이터를 모델링 하기 위해서에요.

서버에서 가져온 데이터에 좀 더 정보를 추가하거나, Relay 가 저장하고 관리할 클라이언트 특화 상태(client-specific state)를 전체적으로 모델링하는 데 유용할 수 있어요ㅏ.

client schema 확장을 사용하면 schema field 에 새로운 field 를 추가해서 기존 type 을 수정하거나,

client 에서만 존재하는 완전히 새로운 type 을 생성할 수 있어요.

## 기존 type 확장하기

기존 type 을 확장하기 위해, `--src` 같은 적당한 디렉터리에 `.graphql` 파일을 추가해요.

```graphql
extend type Comment {
  is_new_comment: Boolean
}
```

`Comment` type 이 있어요. 

컴포넌트에서는 이 `Comment` 타입을 읽어서 render 하고 Relay API 를 이용하면 이 `Comment` 타입을 업데이트 할 수 있어요.

예제에서는 `extend` 키워드를 사용해서 이 기존의 `Comment` type 을 확장하고 있어요. 

이렇게 `Comment` type 을 확장하면,

어떤 comment 가 새로 추가되었을 때, 기존에는 구현할 수 없었던 새로운 시각적 요소를 추가하여 컴포넌트를 render 할 수 있어요.

## 새로운 Type 추가하기

`html/js/relay/schema/` 디렉토리에 `.graphql` 파일을 생성하고 GraphQL 문법을 사용해서 새로운 type 을 정의할 수 있어요.

```graphql
# 하나의 파일에 여러 type 을 정의할 수 있어요.
enum FetchStatus {
  FETCHED
  PENDING
  ERRORED
}


type FetchState {
  # 다른 타입을 정의하기 위해 client type 들을 재사용할 수 있어요.
  status: FetchStatus

  # 일반적인 server type 들을 참조할 수도 있어요
  started_by: User!
}

extend type Item {
  # Server Type 을  client-only type 을 사용해서 확장할 수 있어요
  fetch_state: FetchState
}
```

- 다소 인위적인 예시지만, 두 개의 client-only type 과 enum, 일반적인 type 을 정의했어요. 이 type 들은 자기자신들을 참조할 수도 있고, server 에서 정의한 일반적인 type 을 참조할 수도 있어요. 또 server type 에 client-only type 을 추가해서 확장하는 것도 가능해요.
- 앞서 언급했듯, Relay API 를 이용해서 이 데이터들을 정상적으로 읽고 쓰는 것이 가능해요.

## Client-Only 데이터 읽기

fragment 나 query 내부에서 다른 일반적인 데이터에 접근하듯, Client-only 데이터에도 접근할 수 있어요.

```typescript
const data = useFragment(
  graphql`
    fragment CommentComponent_comment on Comment {
      # 다른 field 접근하듯 client-only field 에도 접근이 가능해요
      is_new_comment

      body {
        text
      }
    }
  `,
  props.user,
);
```

## Client-Only 데이터 업데이트 하기

client-only 데이터를 업데이트하기 위해, 일반적으로 사용하는 mutation 이나 subscription updater 들을 사용할 수도 있고, local 데이터를 업데이트하는 데 사용하는 API 들도 마찬가지로 사용 가능해요.
