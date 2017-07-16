'use strict';

import Tailored from '../src/index.js';
const expect = require('chai').expect;
const ErlangTypes = require('erlang-types');
const Tuple = ErlangTypes.Tuple;

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
    let [a] = Tailored.match([$, 2, _, 4], [1, 2, 3, 4]);
    expect(a).to.equal(1);
  });

  it('must throw an error when there is no match', () => {
    expect(Tailored.match.bind(Tailored.match, [$, 2, _, 4], 1)).to.throw(
      'No match for: 1'
    );
  });

  it('must match values in object', () => {
    let [a] = Tailored.match({ a: [1, $, 3] }, { a: [1, 2, 3] });
    expect(a).to.equal(2);
  });

  it('must match on capture variables', () => {
    let a = 1;

    let [b] = Tailored.match(Tailored.capture(a), 1);
    expect(b).to.equal(1);

    let c = { a: 1 };

    let [d] = Tailored.match(Tailored.capture(c), { a: 1 });
    expect(d['a']).to.equal(1);
  });

  it('must throw an error when capture value does not match', () => {
    let a = 1;
    expect(
      Tailored.match.bind(Tailored.match, Tailored.capture(a), 2)
    ).to.throw('No match for: 2');
  });

  it('must work with type values', () => {
    let matches = Tailored.match_or_default(
      new Tuple(Symbol.for('ok'), $),
      new Tuple(Symbol.for('ok'), 1)
    );

    expect(matches.length).to.equal(1);
    expect(matches[0]).to.equal(1);
  });

  it('must match variable names when values are the same', () => {
    let matches = Tailored.match_or_default(
      [Tailored.variable('name'), Tailored.variable('name')],
      [3, 3]
    );

    expect(matches.length).to.equal(2);
    expect(matches[0]).to.equal(3);
  });

  it('must not match variable names with values are different', () => {
    let matches = Tailored.match_or_default(
      [Tailored.variable('name'), Tailored.variable('name')],
      [3, 4]
    );

    expect(matches).to.equal(null);
  });

  it('must match variable names with underscores with values are different', () => {
    let matches = Tailored.match_or_default(
      [Tailored.variable('_name'), Tailored.variable('_name')],
      [3, 4]
    );

    expect(matches.length).to.equal(2);
    expect(matches[0]).to.equal(3);
  });
});
