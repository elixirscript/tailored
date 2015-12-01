'use strict';

let expect = require('chai').expect;
let Tailored = require('../lib/tailored');

const _ = Tailored.wildcard();
const $ = Tailored.variable();

describe('match', () => {
  it('must return value on parameter', () => {
    let [a] = Tailored.match($, 1);
    expect(a).to.equal(1);
  });

  it('must ignore value when wildcard given', () => {
    let [a] = Tailored.match(_, 1);
    expect(a).to.equal(undefined);
  });

  it('must match on multiple values when an array is given', () => {
    let [a, ] = Tailored.match([$, 2, _, 4], [1, 2, 3, 4]);
    expect(a).to.equal(1);
  });

  it('must throw an error when there is no match', () => {
    expect(Tailored.match.bind(Tailored.match, [$, 2, _, 4], 1)).to.throw("No match for: 1");
  });

  it('must match values in object', () => {
    let [a] = Tailored.match({a: [1, $, 3]}, {a: [1, 2, 3]});
    expect(a).to.equal(2);
  });

  it('must match on capture variables', () => {
    let a = 1;

    let [b] = Tailored.match(Tailored.capture(a), 1);
    expect(b).to.equal(1);

    let c = {a: 1};

    let [d] = Tailored.match(Tailored.capture(c), {a: 1});
    expect(d["a"]).to.equal(1);
  });

  it('must throw an error when capture value does not match', () => {
    let a = 1;
    expect(Tailored.match.bind(Tailored.match, Tailored.capture(a), 2)).to.throw("No match for: 2");
  });
});
