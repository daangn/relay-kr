# Thinking in Relay

Relay의 데이터 페칭 기법은 React로부터 영감을 받았다. React는 복잡한 인터페이스를 재사용 가능한 **컴포넌트 단위**로 나누는데, 이는 개발자로 하여금 어플리케이션을 나눌 수 있는 **최소한의 독립된 단위**를 생각해보도록 하고, 어플리케이션 내부 각기 다른 부분들 간의 결합도가 낮아지도록 한다. 더 중요한 점은 이러한 컴포넌트가 **선언적**이라는 점이다: 개발자는 *UI의 특정 상태*가 주어졌을 때 *어떤 모습*이어야하는지 구체화하고, UI를 _어떻게 보이게 할지는_ 생각하지 않아도 된다. DOM과 같이 명령형 커맨드를 이용해 native 뷰를 조작하는 이전의 접근 방법과는 다르게, React는 UI description을 이용해 필요한 커맨드를 자동적으로 결정한다.

이러한 아이디어가 어떻게 Relay에 적용되었는지 몇 가지 use-case를 보며 알아보자.

## 뷰를 위한 데이터 페칭

경험 상, 대부분의 프로덕트는 한가지 특정 기능을 원했다: 로딩 인디케이터가 표시되는 동안 뷰에서 필요한 모든 데이터를 한꺼번에 페칭하고, 모든 데이터가 로드된 이후 전체 뷰를 한번에 렌더링되도록 하는 것이었다.

이에 대한 한 가지 해결책은 최상위 컴포넌트에서 어떤 데이터를 필요로 하는지 정의하고 페칭하는 것이다. 그러나, 이는 부모-자식 컴포넌트 간 결합도를 높인다: 자식 컴포넌트에서 생기는 변화는 이를 포함하는 루트 컴포넌트의 변경도 함께 가져올 것이다! 이러한 커플링은 버그의 위험성을 높이고 개발의 속도를 낮춘다.

다른 논리적인 접근법은 각각의 컴포넌트로 하여금 필요한 데이터를 정의하고 페칭하게 하는 것이다. 이는 좋은 듯 보이지만, 컴포넌트가 어떤 데이터를 받느냐에 따라 다른 children을 렌더링 할 수 있다는 문제점이 있다. 따라서, 중첩된 컴포넌트에서 자식 컴포넌트는 부모 컴포넌트의 쿼리가 실행이 완료될 때까지 렌더링 및 데이터 페칭이 불가하다. 즉, *데이터 페칭이 단계적으로 발생*하게 된다: 첫째는 루트에서 필요한 데이터를 페칭하고, children을 렌더링하면서 필요한 데이터를 페칭하고, 이를 계속해서 최하위 컴포넌트에 도달할 때까지 반복한다. 렌더링에는 여러 번의 느리고 연속적인 네트워크 요청이 요구될 것이다.

Relay는 이 두가지의 접근 방식에 착안하여 컴포넌트로 하여금 어떤 데이터를 필요로 하는지 명시하도록 요구하는 동시에, 이를 컴포넌트들의 subtree에서 사용할 모든 데이터를 페칭할 하나의 쿼리로 합친다. 즉, 어플리케이션이 실행되기 전, 코드를 작성할 때 모든 뷰에 필요한 데이터에 대한 요구사항을 _정적으로_ 정의할 수 있다는 것이다!

이를 위해 GraphQL이 사용되는데, 함수형 컴포넌트는 하나 이상의 GraphQL [프래그먼트](https://relay.dev/docs/guided-tour/rendering/fragments/)를 이용해 그들의 데이터 요구 사항을 정의한다. 이러한 프래그먼트는 다른 프래그먼트에 중첩되어 있고, 궁극적으로 쿼리 안에 존재하게 된다. 그리고 이러한 쿼리가 페치될 때, Relay는 하나의 네트워크 요청을 실행하고 내부의 중첩된 프래그먼트를 가져온다. 즉, Relay runtime은 뷰에 필요한 모든 데이터를 이 _한 번의 네트워크 요청_ 을 통해 가져올 수 있다는 것이다.

작동하는 방식을 자세히 살펴보자.

## 컴포넌트에 필요한 데이터 구체화하기

Relay에서는, 컴포넌트를 위한 데이터 요구사항은 [프래그먼트](https://relay.dev/docs/guided-tour/rendering/fragments/)를 통해 명세된다. 프래그먼트는 특정 타입의 객체에서 어떤 필드를 필요로 하는지 명시할 수 있도록 하는 GraphQL의 named snippet이며, GraphQL 문법으로 작성한다. 예를 들어, 다음은 작가의 이름과 사진 url을 선택하는 프래그먼트를 작성한 것이다.

```jsx
// AuthorDetails.react.js
const authorDetailsFragment = graphql`
  fragment AuthorDetails_author on Author {
    name
    photo {
      url
    }
  }
`;
```

이 데이터는 React 함수형 컴포넌트 내부에서 `useFragment(...)` 훅의 호출을 통해 스토어로부터 읽어진다. 데이터를 읽을 실제 author 객체는 `useFragment` 의 2번째 인자로 전달된다. 예를 들어:

```jsx
// AuthorDetails.react.js
export default function AuthorDetails(props) {
  const data = useFragment(authorDetailsFragment, props.author);
  // ...
}
```

두번째 파라미터인 `props.author`는 프래그먼트의 레퍼런스이다. 이는 하나의 프래그먼트를 다른 프래그먼트나 쿼리에 **spreading**하여 얻어진다. 프래그먼트는 직접적으로 페칭할 수 없고, 대신 모든 프래그먼트는 궁극적으로 페치하고자 하는 쿼리의 내부에 spread되어 사용된다.

이 프래그먼트를 사용하는 한 쿼리를 살펴보자.

## Queries

데이터를 페치하기 위해, 프래그먼트 `AuthorDetails_author` 를 spread하는 쿼리를 만들어보자.

```jsx
// Story.react.js
const storyQuery = graphql`
  query StoryQuery($storyID: ID!) {
    story(id: $storyID) {
      title
      author {
        ...AuthorDetails_author
      }
    }
  }
`;
```

이제 `const data = useLazyLoadQuery(storyQuery, {storyID})` 를 통해 쿼리를 페치할 수 있다. 이 부분에서, `data.author`(모든 데이터는 기본적으로 nullable이지만, 데이터가 있다는 가정 하에) 는 `AuthorDetails`로 전달할 수 있는 프래그먼트 레퍼런스로 작용한다.

예를 들어:

```jsx
// Story.react.js
function Story(props) {
  const data = useLazyLoadQuery(storyQuery, props.storyId);

  return (
    <>
      <Heading>{data?.story.title}</Heading>
      {data?.story?.author && <AuthorDetails author={data.story.author} />}
    </>
  );
}
```

여기서 우리는 한 번의 네트워크 요청을 이용해 `Story` 컴포넌트와 `AuthorDetails` 컴포넌트에 **필요한 데이터를 모두 가져왔다.** 모든 데이터가 로드된 후, 전체 뷰는 한 번에 렌더링 될 수 있다.

## 데이터 마스킹

전형적인 데이터 페칭 방법으로 두개의 컴포넌트가 _간접적인 의존성_ 을 가지는 방법이 있다. 위의 예시에서, `<Story />` 는 데이터가 페칭되었다는 명시적인 보장 없이 몇 개의 데이터를 사용하는 상황이 있을 수 있다. 이 데이터는 `<AuthorDetails />`과 같이 종종 시스템의 다른 부분에서 로드되곤 하는데, 이런 상황에서 `<AuthorDetails />` 내부의 데이터 페칭 로직을 제거하면 `<Story />`는 갑자기 알 수 없는 이유로 동작하지 않게 된다. 이런 종류의 버그들은 즉시 발견하기 어렵고, 규모가 큰 어플리케이션일수록 더욱 그렇다. 수동/자동화된 테스팅이 도움이 될 수 있지만, 이는 명백히 시스템적인 문제이고 프레임워크가 더 잘 풀어낼 수 있는 문제이다.

앞에서 Relay는 뷰를 위한 데이터를 한 번에 페칭하는 것이 보장됨을 이미 보았다. 여기에 더해 Relay는 직접적으로 드러나지 않는 또 다른 이점을 제공하는데, 바로 **데이터 마스킹**이다. Relay는 컴포넌트들이 프래그먼트를 통해 요청한 데이터에만 접근이 가능하도록 제한한다. 따라서 만약 한 컴포넌트가 Story의 `title` 필드를 참조하고, 다른 한 컴포넌트는 `text` 필드를 참조하고 있다면, 각각은 그들이 요구한 필드만을 참조할 수 있다. 심지어 컴포넌트들은 그들의 _자식 컴포넌트_ 가 요청한 데이터도 볼 수 없다. 왜냐면 이 역시 캡슐화를 깨기 때문이다.

Relay는 여기서 더 확장되는데, 컴포넌트를 렌더링하기 전에 명시적으로 데이터를 페치했음을 검증하기 위해 `props` 에 opaque(불투명한) identifier를 사용한다. 만약 `<Story />`가 `<AuthorDetails />` 를 렌더링했지만, 그 프래그먼트가 spread되지 않았다면, Relay는 `<AuthorDetails />`에 전달될 데이터가 누락되었음을 경고해준다. 심지어 Relay는 `<AuthorDetails />` 에서 참조한 데이터를 다른 컴포넌트에서 페칭하는 상황에서도 경고를 표시해준다. 이 경고는 지금은 정상적으로 동작하는 코드라 할지라도, 추후에 버그로 이어질 가능성이 높은 부분임을 알려준다.

## 결론

GraphQL은 효율적이고, 독립된 클라이언트 어플리케이션을 위한 강력한 툴을 제공한다. Relay는 이 기반 위에서 **명시적인 데이터 페칭 기능**을 제공하는 프레임워크로 작용한다. **어떻게 데이터가 페치되는지를 어떤 데이터가 페치되는지로부터 분리함으로써,** Relay는 빠르고, 투명하고, 성능이 우수한 어플리케이션을 만들 수 있도록 한다. Relay는 컴포넌트 중심의 사고에 기반한 React의 좋은 조력자이며, React / Relay / GraphQL 은 각각의 기술로도 강력하지만, **이 모두가 결합된 UI 플랫폼**은 대규모 어플리케이션으로 하여금 빠른 변화를 높은 퀄리티로 가능하게 만든다.