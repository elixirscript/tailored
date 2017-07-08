'use strict';

import chai from 'chai';
var expect = chai.expect;

import Tailored from '../src/index.js';
import ErlangTypes from 'erlang-types';
const Tuple = ErlangTypes.Tuple;
const BitString = ErlangTypes.BitString;

const _ = Tailored.wildcard();
const $ = Tailored.variable();

describe('list generator', () => {
  it('must work on simple case', () => {
    let gen = Tailored.list_generator($, [1, 2, 3, 4]);

    let result = [];

    for (let a of gen()) {
      result.push(a);
    }

    expect(result).to.eql([1, 2, 3, 4]);
  });

  it('must only result matching values', () => {
    let gen = Tailored.list_generator(
      Tailored.capture(Tailored.type(Tuple, { values: [1, 2, 3] })),
      [new Tuple(1, 2, 3), 2, 3, 4]
    );

    let result = [];

    for (let a of gen()) {
      result.push(a);
    }

    expect(result).to.eql([new Tuple(1, 2, 3)]);
  });
});

describe('list comprehension', () => {
  it('must work on simple case', () => {
    let gen = Tailored.list_generator($, [1, 2, 3, 4]);
    let comp = Tailored.list_comprehension(Tailored.clause([$], x => x), [gen]);

    expect(comp).to.eql([1, 2, 3, 4]);
  });

  it('must work on two generators', () => {
    let gen = Tailored.list_generator($, [1, 2]);
    let gen2 = Tailored.list_generator($, [3, 4]);
    let comp = Tailored.list_comprehension(
      Tailored.clause([$, $], (x, y) => x * y),
      [gen, gen2]
    );

    expect(comp).to.eql([3, 4, 6, 8]);
  });

  it('must work on three generators', () => {
    let gen = Tailored.list_generator($, [1, 2]);
    let gen2 = Tailored.list_generator($, [3, 4]);
    let gen3 = Tailored.list_generator($, [5, 6]);

    let comp = Tailored.list_comprehension(
      Tailored.clause([$, $, $], (x, y, z) => x * y * z),
      [gen, gen2, gen3]
    );

    expect(comp).to.eql([15, 18, 20, 24, 30, 36, 40, 48]);
  });

  it('must work with guards', () => {
    let gen = Tailored.list_generator($, [1, 2]);
    let gen2 = Tailored.list_generator($, [3, 4]);
    let comp = Tailored.list_comprehension(
      Tailored.clause([$, $], (x, y) => x * y, x => x > 1),
      [gen, gen2]
    );

    expect(comp).to.eql([6, 8]);
  });
});

describe('binary comprehension', () => {
  it('must work on simple case', () => {
    let gen = Tailored.bitstring_generator(
      Tailored.bitStringMatch(BitString.integer({ value: $ })),
      new BitString(
        BitString.integer(1),
        BitString.integer(2),
        BitString.integer(3)
      )
    );
    let comp = Tailored.bitstring_comprehension(
      Tailored.clause(
        [Tailored.bitStringMatch(BitString.integer({ value: $ }))],
        x => x * 2
      ),
      [gen]
    );

    expect(comp).to.eql(
      new BitString(
        BitString.integer(2),
        BitString.integer(4),
        BitString.integer(6)
      )
    );
  });
});
