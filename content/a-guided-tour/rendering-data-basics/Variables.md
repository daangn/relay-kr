# Variables

위의 예시에서 쿼리 선언에 `$id` 심볼이 사용되어 참조값을 포함할 수 있었다.

GraphQL 변수는 쿼리 안에서 동적인 값을 참조할 수 있도록 한다. 서버에서 쿼리를 패치할 때, 실제 값들의 세트를 input으로 제공하여 쿼리 내에서 선언된 변수로 활용할 수 있어야 한다.

```graphql
query UserQuery($id: ID!) {

  # $id: user()의 input
  user(id: $id) {
    id
    name
  }

}
```

위의 예시에서 `ID!` 는 `$id` 변수의 타입을 의미한다. 여기서 `!` 는 `ID` 타입 값이 필수로 요구되는 필드라는 것을 의미한다.

네트워크에 쿼리 패칭을 요청할 때, 우리는 쿼리와 특정 쿼리를 실행하기 위한 변수를 함께 전달해야 한다.

```graphql
# Query:
query UserQuery($id: ID!) {
  # ...
}

# Variables:
{"id": 4}
```

위의 쿼리와 변수를 패칭하면 서버는 다음과 같은 응답을 가져온다:

```graphql
{
  "data": {
    "user": {
      "id": "4",
      "name": "Mark Zuckerberg"
    }
  }
}
```

- input으로 쓰인 `id` 변수 값을 변경하면 당연히, 다른 응답이 돌아온다.

---

프래그먼트는 쿼리에서 정의한 변수를 참조할 수 있다.

```graphql
fragment UserFragment on User {
  name
  profile_picture(scale: $scale) {
    uri
  }
}

query ViewerQuery($scale: Float!) {
  viewer {
    actor {
      ...UserFragment
    }
  }
}
```

- 위의 프래그먼트에서 `$scale` 변수를 직접 정의하지 않아도, 여전히 참조가 가능하다. 따라서 해당 프래그먼트를 지닌 쿼리는 직접적이든 간접적이든 무조건 변수와 그의 타입을 정의해야 한다. (이러지 않으면 에러 생성)
- 즉, 쿼리 변수는 해당 쿼리의 후손인 어떤 프래그먼트에서든 globally 사용 가능하다.
- 전역 변수를 참조하는 프래그먼트는 해당 전역 변수를 정의한 쿼리 내에만 존재 가능하다.

Relay에서는 컴포넌트 내에서 프래그먼트를 정의할 시 쿼리 변수를 참조할 수 있다.:

```graphql
function UserComponent(props: Props) {
  const data = useFragment(
    graphql`
    fragment UserComponent_user on User {
      name
      profile_picture(scale: $scale) {
        uri
      }
    }
    `,
    props.user,
  );

  return (...);
}
```

- 위의 프래그먼트는 다량의 쿼리에 포함되고 다른 컴포넌트에 의해 렌더링 될 수 있는데, 이는 위의 프래그먼트를 렌더링하는/ 포함하는 쿼리는 반드시 `$scale` 변수를 정의해야 한다는 것이다.
- 만약 위의 프래그먼트를 포함하는 쿼리가 `$scale` 변수를 정의하지 않은 경우, 빌드 타임 때 Relay 컴파일러에 의해 에러가 발생할 것이며, 이는 잘못된 쿼리는 절대 서버에 전송되지 않는다는 것을 보장한다. (변수 선언이 빠진 쿼리를 보내는 것은 서버에서 에러를 발생시킨다.)

### @arguments and @argumentDefinitions

하지만, 전역 변수를 포함하면서 쿼리의 부피가 커지는 것을 방지하기 위해, Relay는 지역적으로 변수를 선언하여 프래그먼트에 종속되도록 하는 방법을 제공한다. 이는 `@arguments` 와 `@argumentDefinitions` directive를 사용한다.:

```jsx
/**
 * @argumentDefinitions 를 이용해 arguments를 갖는 fragment 정의
 */

function PictureComponent(props) {
  const data = useFragment(
    graphql`
      fragment PictureComponent_user on User
        @argumentDefinitions(scale: {type: "Float!"}) {

        # *`**$scale**`* is a local variable here, declared above
        # as an argument *`**scale**`*, of type *`**Float!`*
        profile_picture(scale: $scale) {
          uri
        }
      }
    `,
    props.user,
  );
}
```

```jsx
/**
 * @arguments 를 이용해 fragment 포함시키기
 */

function UserComponent(props) {
  const data = useFragment(
    graphql`
      fragment UserComponent_user on User {
        name

        # Pass value of 2.0 for the *`*scale*`* variable
        ...PictureComponent_user @arguments(scale: 2.0)
      }
    `,
    props.user,
  );
}
```

```jsx
/**
 * 다른 @arguments 를 이용한 위와 같은 fragment
 */

function OtherUserComponent(props) {
  const data = useFragment(
    graphql`
      fragment OtherUserComponent_user on User {
        name

        # Pass a different value for the scale variable.
        # The value can be another local or global variable:
        ...PictureComponent_user @arguments(scale: $pictureScale)
      }
    `,
    props.user,
  );
}
```

- `@arguments` 를 프래그먼트에 전달할 때, 리터럴 변수나 다른 변수를 전달할 수도 있다. 이는 전역 쿼리 변수가 될 수도 있고, `@argumentDefinitions` 로 선언한 다른 지역 변수가 될 수도 있다.
- `PictureComponent_user` 을 쿼리의 일부로 직접 패치할 경우, `profile_picture` 필드에 전달되는 `scale` 변수는 부모인 `PictureComponent_user` 로부터 제공받는 인자에 의존한다.
    - `UserComponent_user` 를 위한 `$scale` : 2.0
    - `OtherUserComponent_user` 를 위한 `$scale` : 쿼리를 패치할 때 서버에 보내는 `$pictureScale` 변수 값

인자값이 필요한 프래그먼트에도 기본 값을 정의할 수 있는데, 이로써 인자값을 optional하게 설정할 수 있다.:

```jsx
/**
 * 기본값으로 arguments 초기화
 */

function PictureComponent(props) {
  const data = useFragment(
    graphql`
      fragment PictureComponent_user on User
        @argumentDefinitions(scale: {type: "Float!", defaultValue: 2.0}) {

        # *`**$scale**`* is a local variable here, declared above
        # as an argument *`**scale**`*, of type *`**Float!` with a default value of *`2.0**`**
        profile_picture(scale: $scale) {
          uri
        }
      }
    `,
    props.user,
  );
}
```

```jsx
function UserComponent(props) {
  const data = useFragment(
    graphql`
      fragment UserComponent_user on User {
        name

        # Do not pass an argument, value for scale will be **`2.0**`**
        ...PictureComponent_user
      }
    `,
    props.user,
  );
}
```

- `PictureComponent_user` 에 인자를 전달하지 않을 경우 지역변수로 정의한 `$scale` 에는 기본값인 2.0이 할당된다.

### Accessing GraphQL Variables At Runtime

루트 쿼리에 세팅된 변수에 접근하고 싶을 경우, props를 사용하여 앱의 컴포넌트 트리나 어플리케이션만의 고유한 context에 변수를 전파하는 방법을 추천한다.

Relay는 argument definitions를 적용한 이후, 특정 프래그먼트에 할당되는 resolved된 변수를 드러내지 않는데, 이를 따로 정의해야하는 경우도 별로 없다.