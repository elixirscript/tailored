# Tailored

## A pattern matching library

This is the pattern matching library ported from elixirscript. It allows you to
create functions that will perform pattern matching on the input and either execute
the corresponding function or throw a `tailored.MatchError`.

```js
const tailored = require('tailored');
const _ = tailored.wildcard();
const $ = tailored.parameter();

let fact = tailored.defmatch(
  tailored.clause([0], () => 1),
  tailored.clause([$], (n) => n * fact(n - 1))
);

let response = fact(0); //1
response = fact(10); //3628800
```

### API

 * `tailored.defmatch(...clauses): Function` - Takes one or more `tailored.Clause` objects and returns
 a pattern match function. It cycles through the clauses and if a corresponding pattern matches, and the guard is true,
 then the matching parameters are passed to the corresponding function that will execute. If no matching clause is found, a `tailored.MatchError` is thrown.

* `tailored.clause(patterns: Array[any], fn: Function, guard: Function = () => true): tailored.Clause` - A helper function for creating `tailored.Clause` objects. It takes an array of patterns, the function to execute if the pattern matches, and a guard function.


* `tailored.match(pattern: any, expression: any): [any]` - Tries to match the pattern with the given expression


* `tailored.wildcard()` - Returns a wildcard pattern. Matches on anything.

* `tailored.variable()` - Returns a variable pattern. Matches on a value and uses it as a parameter for the clause functions

* `tailored.startsWith(prefix: String)` - Returns a startsWith pattern. Matches on strings with the given string as a prefix

* `tailored.headTail()` - Returns a headTail pattern. Matches arrays and returns both the head element and the tail elements as parameters

* `tailored.type(type: any, properties: Object = {})` - Returns a type pattern. Match on the type and it's properties for matching patterns.

* `tailored.capture(pattern: any)` - Returns a capture pattern. Matches on it's patterns, and then returns the pattern as a parameter


### Examples

* Matches on anything, returning one
  ```js
  var fn = tailored.defmatch(tailored.clause([_], function () {
    return 1;
  }));

  fn("ABC") // 1
  ```

* Using a guard
  ```js  
    let fn = tailored.defmatch(
      tailored.clause([$], (number) => number, (number) => number > 0)
    );

    fn(0); //throws MatchError
    fn(3); //returns 3;
    ```

* Match values in an object
  ```js
  var fn = tailored.defmatch(
    tailored.clause([{ value: $ }], function (val) { return 1 + val; }),
    tailored.clause([{ a: { b: { c: $ } } }], function (val) { return 1 - val; })
  );

  fn({value: 20}) //21;
  fn({a: {b: {c: 20}, d: 10 } }) // 19
  ```


  More examples can be found in the tests
