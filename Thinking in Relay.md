# Thinking in Relay

Relay의 데이터 패칭 기법은 React로부터 영감을 받았다.

React는 복잡한 인터페이스를 **재사용 가능한 컴포넌트 단위**로 나누는데, 이는 개발자로 하여금 어플리케이션을 나눌 수 있는 **최소한의 독립된 단위**를 생각해보도록 하고, 각각의 부분에서 **의존성을 줄이도**록 한다.

더 중요한 점은 이러한 컴포넌트가 **선언적**이라는 점이다: 개발자는 ***UI의 특정 상태*가 주어졌을 때 어떤 모습**이어야하는지 구체화하고, UI를 ~~*어떻게 보이게 할지는*~~ 생각하지 않아도 된다.

DOM 등을 이용해 native 뷰를 조작하는 command와는 다르게, React는 UI description을 이용해 필요한 command를 결정한다.

이러한 아이디어가 어떻게 Relay에 적용되었는지 몇가지 use-case를 보며 알아보자.

## 뷰를 위한 데이터 패칭

대부분의 프로덕트는 한가지 특정 행동을 원한다: 뷰 계층을 위한 **한 번의 데이터 패칭 시 로딩 인디케이터를 표시하고, 모든 뷰를 모든 데이터가 가능할 때 한번에 렌더링되도록 한다.**

해결책은 **루트 컴포넌트에서 어떤 데이터를 필요로 하는지 정의하고 패칭**하는 것이다.

그러나, 이는 **커플링을 유도**한다: child 컴포넌트에서 어떠한 변화라도 생긴다면 이를 포함하는 루트 컴포넌트의 변화를 요구한다.

이러한 커플링은 버그의 위험성을 높이고 개발의 속도를 낮춘다.

다른 논리적인 접근법은 **각각의 컴포넌트로 하여금 필요한 데이터를 정의하고 패칭하게** 하는 것이다.

이는 좋은 듯 보이지만, 컴포넌트가 어떤 데이터를 받느냐에 따라 다른 children을 렌더링 할 수 있다는 문제점이 있다.

따라서, 중첩된 컴포넌트에서 child 컴포넌트는 부모 컴포넌트의 쿼리가 실행이 완료될 때까지 렌더링 및 데이터 패칭이 불가하다.

즉, **데이터 패칭이 단계적으로 발생**하게 된다: 첫째는 루트에서 필요한 데이터를 패칭하고, children을 렌더링하면서 필요한 데이터를 패칭하고, 이를 계속해서 리프 컴포넌트에 도달할 때까지 반복한다.

이는 느리고, 단계적인 roundtrip(반복적인 작업)을 요구한다. 

Relay는 이 두가지의 접근 방식에 착안하여 **컴포넌트로 하여금 어떤 데이터를 필요로 하는지 명시**하도록 요구하는 동시에, 이를 **독립된 개별 쿼리로 단위를 나누어(프래그먼트) 컴포넌트의 subtree에서 데이터를 패칭하도록** 한다.

즉, 어플리케이션이 run 하기 전, 코드를 작성할 때 모든 뷰에 필요한 데이터에 대한 요구사항을 정적으로 정의할 수 있다는 것이다.

이를 위해 GraphQL을 사용한다.

**FC는 하나 이상의 GraphQL fragment를 이용해 데이터 요구사항을 정의한다.**

이러한 프래그먼트는 다른 프래그먼트에 **중첩**되어 있고, **궁극적으로 쿼리 안에 존재**하게 된다.

그리고 이러한 쿼리가 패치될 때, Relay는 **하나의 네트워크 요청을 실행하고 모든 중첩된 프래그먼트를 이 때 가져오게 된다.**

즉, Relay runtime은 뷰에 필요한 모든 데이터를 이 때 한 번의 네트워크 요청을 통해 가져올 수 있다는 것이다.

작동하는 방식을 자세히 살펴보자.

## Fragment: 컴포넌트에 필요한 데이터 구체화하기

Relay를 통해, **컴포넌트를 위한 데이터 요구사항은 프래그먼트를 통해 구체화**한다.

`Fragment` 는 GraphQL의 named snippet이며 **특정 타입의 객체에서 어떤 필드를 필요로 하는지 명시**할 수 있다.

프래그먼트는 GraphQL 문법으로 작성한다.

예를 들어, 다음은 작가의 이름과 사진 url을 선택하는 프래그먼트를 작성한 것이다.

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

프래그먼트는 함수형 컴포넌트에서 `useFragment` 훅을 이용해 데이터 스토어로부터 읽어진다.

데이터를 읽을 실제 작가(`reference`)는 `useFragment` 의 2번째 인자로 전달된다. 예를 들어:

```jsx
// AuthorDetails.react.js
export default function AuthorDetails(props) {
  const data = useFragment(authorDetailsFragment, props.author);
  // ...
}
```

`[props.author](http://props.author)` 은 **프래그먼트 reference** 이다.

이는 하나의 프래그먼트를 다른 프래그먼트나 쿼리에 spreading하여 얻어진다.

프래그먼트는 직접적으로 패칭할 수 없다.

대신에, 모든 프래그먼트는 궁극적으로 패치될 데이터의 쿼리 안에 spread 된다.

이 프래그먼트를 사용할 쿼리를 살펴보자.

## Queries

데이터를 패치하기 위해, 프래그먼트 `AuthorDetails_author` 를 spread하는 쿼리를 만들어보자.

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

이제 `const data = useLazyLoadQuery(storyQuery, {storyID})` 를 통해 쿼리를 패치할 수 있다.

이 부분에서, `[data.author](http://data.author)` *(모든 데이터는 기본적으로 nullable이지만, 데이터가 있다는 가정 하에)* 는 `AuthorDetails` 를 전달할(spread) 수 있는 프래그먼트 레퍼런스로 작용한다.

예를 들어:

```jsx
// Story.react.js
function Story(props) {
	// $storyId === props.storyId
	// id === $storyId === props.storyId
  const data = useLazyLoadQuery(storyQuery, props.storyId);

  return (<>
    <Heading>{data?.story.title}</Heading>
    {data?.story?.author && <AuthorDetails author={data.story.author} />}
  </>);
}
```

여기서 우리는 **한번의 네트워크 요청**을 이용해 `Story` 컴포넌트와 `AuthorDetails` 컴포넌트에 **필요한 데이터를 모두 가져왔다.**

이 데이터가 이용 가능할 때, **전체 뷰는 한 번에 렌더링** 될 수 있다.

## 데이터 마스킹 (캡슐화)

전형적인 데이터 패칭 방법으로 두개의 컴포넌트가 **간접적인 의존성**을 가지는 방법이 있다.

예를 들어 위의 예시에서는 `<Story />` 는 **데이터가 패칭되었다는 명시적인 보장 없이 몇개의 데이터를 사용**할 수 있다.

이는 **다른 부분에서 보통 패치되어** 있는데, `<AuthorDetails />` 등이 이를 의미한다.

만약 이 컴포넌트를 변경하고 데이터 패칭 로직을 제거하면, `Story` 는 *순식간에, 알 수 없는 이유로* 깨지게 된다.

이러한 **타입 버그는 매번 즉각적으로 명백하게 드러나지 않기 때문에**, 규모가 큰 어플리케이션에서는 더더욱, *단계적이고 자동화된 테스팅*만이 이를 방지할 수 있다.

하지만 이는 명백하게 시스템적인 문제이고 ***프레임워크로 보완할 수 있는 부분***이다.

Relay는 **뷰를 위한 데이터를 한번에 패칭**할 수 있도록 한다.

여기에 더해 Relay는 **data masking을 통해** 명백하지 않은 이점 또한 제공한다.

Relay는 **컴포넌트만이 GraphQL 프래그먼트로 요구하는 데이터를 특정하여 요구할 수 있도록 한다.**

따라서 만약 하나의 컴포넌트 쿼리가 Story의 `title` 을 요구하고 다른 하나가 `text` 를 요구한다면, **각각은 요구한 필드만을 참고할 수 있다.**

사실, 컴포넌트는 **children에서 요구한 데이터도 볼 수 없다.** 이건 결국 **캡슐화를 무너뜨리기 때문**이다.

Relay는 여기서 더 확장되는데, `**props` 에 opaque(불투명한) identifier를 이용해 컴포넌트를 렌더링하기 전에 명백하게 데이터를 패치했음을 입증**한다.

만약 `*Story` 가 `AuthorDetails` 를 렌더링했지만 프래그먼트를 spread하는 것을 잊었다면,* Relay는 AuthorDetails의 데이터가 없다는 것을 경고한다.

사실, Relay는 *다른 컴포넌트가 AuthorDetails가 요구하는 데이터와 같은 데이터를 패치*할 때도 경고를 띄운다.

이 경고는 지금은 작동할 지라도, 나중에 깨질 수 있다는 것을 의미한다.

## 결론

GraphQL은 효율적이고, **독립된** 클라이언트 어플리케이션을 위한 강력한 툴을 제공한다.

Relay는 **명시적인 데이터 패칭 기능**을 제공하는 프레임워크로 작용한다.

**어떻게 데이터가 패치되는지를 어떤 데이터가 패치되는지로부터 분리함으로써,** Relay는 빠르고, 투명하고, 성능이 우수한 어플리케이션을 만들 수 있도록 한다.

**컴포넌트 중심의 사고**에 기반해서 좋은 완충제가 될 수 있고, React/ Relay/ GraphQL 각각의 기술이 그 자체로 강력하지만, 이 모두가 결합된 UI 플랫폼은 대규모 어플리케이션으로 하여금 빠른 이동과 변화를 높은 퀄리티로 가능하게 만든다.