# Managing Data Outside React

## Query 유지하기

Relay 가 참조 데이터를 가비지 컬렉팅 하지 않도록 query 를 수동으로 유지하기 위해 `environment.retain` 메서드를 사용할 수 있어요.

```typescript
const {
  createOperationDescriptor,
  getRequest,
  graphql,
} = require('relay-runtime')

// 일반적인 GraphQL query 오브젝트
const query = graphql`...`;

// query 를 Relay 가 다루는 방식으로 가공하여 생성해요
const queryRequest = getRequest(query);
const queryDescriptor = createOperationDescriptor(
  queryRequest,
  variables
);

// Retain query; 
// Relay 가비지 컬렉션이 이 query 데이터를 수거하지 않도록 해요.
const disposable = environment.retain(queryDescriptor);

// dispose 를 호출하면
// 이 query 는 Relay 의 가비지 컬렉션 대상이 되어 데이터를 수거할 수 있어요.
// 단, 다른 위치에서 해당 query 를 retain 하지 않아야 해요.
disposable.dispose();
```

### 알아두세요
Relay 는 data 를 render 하는 mount 상태의 query 컴포넌트를 기반으로 query data retain 을 자동으로 관리해요.
그래서 일반적인 상황에서는 production code 에서 retain 을 직접 호출할 필요가 없어요.
좀 더 특수하거나 고급적인 사용을 고려한다면, query data retention 은 Router 와 같은 infra-leve 코드에서 다뤄야 해요.