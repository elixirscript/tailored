'use strict';

let expect = require('chai').expect;
let Tailored = require('../lib/tailored');

const _ = Tailored.wildcard();
const $ = Tailored.variable();

describe('defmatch', () => {
  it('must correctly evaluate example', () => {

    let fact = Tailored.defmatch(
      Tailored.clause([0], () => 1),
      Tailored.clause([$], (n) => n * fact(n - 1))
    );

    let response = fact(0);
    expect(response).to.equal(1);

    response = fact(10);
    expect(response).to.equal(3628800);
  });
});

describe('defmatch', () => {
  it('must throw error when no match is found', () => {

    let fn = Tailored.defmatch(
      Tailored.clause([0], () => 1)
    );

    expect(fn.bind(fn, 1)).to.throw("No match for: 1");
  });

  it('must have wildcard except everything', () => {

    let fn = Tailored.defmatch(
      Tailored.clause([_], () => 1)
    );

    expect(fn(1)).to.equal(1);
    expect(fn("1")).to.equal(1);
    expect(fn("ABC")).to.equal(1);
    expect(fn(() => 34)).to.equal(1);
  });

  it('must work symbols', () => {

    let fn = Tailored.defmatch(
      Tailored.clause([Symbol.for('infinity')], () => 1)
    );

    expect(fn(Symbol.for('infinity'))).to.equal(1);
    expect(fn.bind(fn, Symbol('infinity'))).to.throw("No match for: Symbol(infinity)");
  });

  it('must match on values in object', () => {

    let fn = Tailored.defmatch(
      Tailored.clause([{value: $}], (val) => 1 + val),
      Tailored.clause([{a: {b: {c: $} } }], (val) => 1 - val)
    );

    expect(fn({value: 20})).to.equal(21);
    expect(fn({a: {b: {c: 20} } })).to.equal(-19);
  });

  it('must match on objects even when value has more keys', () => {

    let fn = Tailored.defmatch(
      Tailored.clause([{value: $}], (val) => 1 + val),
      Tailored.clause([{a: {b: {c: $} } }], (val) => 1 - val)
    );

    expect(fn({value: 20})).to.equal(21);
    expect(fn({a: {b: {c: 20}, d: 10 } })).to.equal(-19);
  });

  it('must match on substrings', () => {

    let fn = Tailored.defmatch(
      Tailored.clause([Tailored.startsWith("Bearer ")], (token) => token)
    );

    expect(fn("Bearer 1234")).to.equal("1234");
  });


  it('must work with guards', () => {

    let fn = Tailored.defmatch(
      Tailored.clause([$], (number) => number, (number) => number > 0)
    );

    expect(fn(3)).to.equal(3);
    expect(fn.bind(fn, -1)).to.throw("No match for: -1");
  });

  it('must capture entire match as parameter', () => {

    let fn = Tailored.defmatch(
      Tailored.clause([Tailored.capture({a: {b: {c: $} } })], (val, bound_value) => bound_value["a"]["b"]["c"])
    );

    expect(fn({a: {b: {c: 20} } })).to.equal(20);

    fn = Tailored.defmatch(
      Tailored.clause([Tailored.capture([1, $, 3, $])], (a, b, bound_value) => bound_value.length)
    );

    expect(fn([1, 2, 3, 4])).to.equal(4);

    fn = Tailored.defmatch(
      Tailored.clause(
        [Tailored.capture([1, Tailored.capture({a: {b: {c: $} } }), 3, $])],
        (c, two, four, arg) =>  two["a"]["b"]["c"]
      )
    );

    expect(fn([1, {a: {b: {c: 20} } }, 3, 4])).to.equal(20);
  });

  it('must produce a head and a tail', () => {

    let fn = Tailored.defmatch(
      Tailored.clause(
        [Tailored.headTail()],
        (head, tail) => tail
      )
    );

    expect(fn([3, 1, 2, 4]).length).to.equal(3);
  });

});
