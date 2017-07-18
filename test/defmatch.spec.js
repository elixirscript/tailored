'use strict';

import chai from 'chai';
var expect = chai.expect;

import Tailored from '../src/index.js';
import ErlangTypes from 'erlang-types';
const Tuple = ErlangTypes.Tuple;
const BitString = ErlangTypes.BitString;

const _ = Tailored.wildcard();
const $ = Tailored.variable();

describe('defmatch', () => {
  it('must throw error when no match is found', () => {
    let fn = Tailored.defmatch(Tailored.clause([0], () => 1));

    expect(fn.bind(fn, 1)).to.throw('No match for: 1');
  });

  it('must have wildcard except everything', () => {
    let fn = Tailored.defmatch(Tailored.clause([_], () => 1));

    expect(fn(1)).to.equal(1);
    expect(fn('1')).to.equal(1);
    expect(fn('ABC')).to.equal(1);
    expect(fn(() => 34)).to.equal(1);
  });

  it('must work symbols', () => {
    let fn = Tailored.defmatch(
      Tailored.clause([Symbol.for('infinity')], () => 1)
    );

    expect(fn(Symbol.for('infinity'))).to.equal(1);
    expect(fn.bind(fn, Symbol('infinity'))).to.throw(
      'No match for: Symbol(infinity)'
    );
  });

  it('must match on values in object', () => {
    let fn = Tailored.defmatch(
      Tailored.clause([{ value: $ }], val => 1 + val),
      Tailored.clause([{ a: { b: { c: $ } } }], val => 1 - val)
    );

    expect(fn({ value: 20 })).to.equal(21);
    expect(fn({ a: { b: { c: 20 } } })).to.equal(-19);
  });

  it('must match on objects even when value has more keys', () => {
    let fn = Tailored.defmatch(
      Tailored.clause([{ value: $ }], val => 1 + val),
      Tailored.clause([{ a: { b: { c: $ } } }], val => 1 - val)
    );

    expect(fn({ value: 20 })).to.equal(21);
    expect(fn({ a: { b: { c: 20 }, d: 10 } })).to.equal(-19);
  });

  it('must match on substrings', () => {
    let fn = Tailored.defmatch(
      Tailored.clause([Tailored.startsWith('Bearer ')], token => token)
    );

    expect(fn('Bearer 1234')).to.equal('1234');
  });

  it('must work with guards', () => {
    let fn = Tailored.defmatch(
      Tailored.clause([$], number => number, number => number > 0)
    );

    expect(fn(3)).to.equal(3);
    expect(fn.bind(fn, -1)).to.throw('No match for: -1');
  });

  it('must capture entire match as parameter', () => {
    let fn = Tailored.defmatch(
      Tailored.clause(
        [Tailored.capture({ a: { b: { c: $ } } })],
        (val, bound_value) => bound_value['a']['b']['c']
      )
    );

    expect(fn({ a: { b: { c: 20 } } })).to.equal(20);

    fn = Tailored.defmatch(
      Tailored.clause(
        [Tailored.capture([1, $, 3, $])],
        (a, b, bound_value) => bound_value.length
      )
    );

    expect(fn([1, 2, 3, 4])).to.equal(4);

    fn = Tailored.defmatch(
      Tailored.clause(
        [Tailored.capture([1, Tailored.capture({ a: { b: { c: $ } } }), 3, $])],
        (c, two, four, arg) => two['a']['b']['c']
      )
    );

    expect(fn([1, { a: { b: { c: 20 } } }, 3, 4])).to.equal(20);
  });

  it('must produce a head and a tail', () => {
    let fn = Tailored.defmatch(
      Tailored.clause([Tailored.headTail()], (head, tail) => tail)
    );

    expect(fn([3, 1, 2, 4]).length).to.equal(3);
  });

  it('must match on tuple', () => {
    let fn = Tailored.defmatch(
      Tailored.clause([Tailored.type(Tuple, { values: [1, 2, 3] })], () => 3)
    );

    expect(fn(new Tuple(1, 2, 3))).to.equal(3);
    expect(fn.bind(fn, new Tuple(1, 2, 4))).to.throw('No match for: {1, 2, 4}');
  });

  describe('BitString', () => {
    it('must match on a string', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [
            Tailored.bitStringMatch(
              BitString.integer(102),
              BitString.integer(111),
              BitString.integer(111)
            )
          ],
          () => 3
        )
      );

      expect(fn('foo')).to.equal(3);
      expect(fn.bind(fn, 'bar')).to.throw('No match for: bar');
    });

    it('must match on a bitstring', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [
            Tailored.bitStringMatch(
              BitString.integer(102),
              BitString.integer(111),
              BitString.integer(111)
            )
          ],
          () => 3
        )
      );

      expect(
        fn(
          new BitString(
            BitString.integer(102),
            BitString.integer(111),
            BitString.integer(111)
          )
        )
      ).to.equal(3);
    });

    it('must allow for variables', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [
            Tailored.bitStringMatch(
              BitString.integer({ value: $ }),
              BitString.integer(111),
              BitString.integer(111)
            )
          ],
          pattern => pattern
        )
      );

      expect(
        fn(
          new BitString(
            BitString.integer(102),
            BitString.integer(111),
            BitString.integer(111)
          )
        )
      ).to.equal(102);
    });

    it('must match on variable and convert to type', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [
            Tailored.bitStringMatch(
              BitString.integer(102),
              BitString.binary({ value: $ })
            )
          ],
          b => b
        )
      );

      expect(
        fn(
          new BitString(
            BitString.integer(102),
            BitString.integer(111),
            BitString.integer(111)
          )
        )
      ).to.equal('oo');
    });

    it('throw error when binary is used without size', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [
            Tailored.bitStringMatch(
              BitString.binary({ value: $ }),
              BitString.binary(' the '),
              BitString.binary({ value: $ })
            )
          ],
          (name, species) => name
        )
      );

      expect(fn.bind(fn, 'Frank the Walrus')).to.throw(
        'a binary field without size is only allowed at the end of a binary pattern'
      );
    });

    it('allow binary pattern with size', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [
            Tailored.bitStringMatch(
              BitString.size(BitString.binary({ value: $ }), 5),
              BitString.binary(' the '),
              BitString.binary({ value: $ })
            )
          ],
          (name, species) => name
        )
      );

      expect(fn('Frank the Walrus')).to.equal('Frank');
    });

    it('allow unsigned integer', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [Tailored.bitStringMatch(BitString.integer({ value: $ }))],
          int => int
        )
      );

      expect(fn(new BitString(BitString.integer(-100)))).to.equal(156);
    });
  });

  describe('Optional Arguments', () => {
    it('single optional argument', () => {
      let fn = Tailored.defmatch(
        Tailored.clause([Tailored.variable(null, 2)], arg => arg)
      );

      expect(fn()).to.equal(2);
      expect(fn(3)).to.equal(3);
    });

    it('single optional argument and one required argument', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [Tailored.variable(), Tailored.variable(null, 2)],
          (arg1, arg2) => arg1 + arg2
        )
      );

      expect(fn.bind(fn)).to.throw('No match for:');
      expect(fn(1)).to.equal(3);
      expect(fn(3, 4)).to.equal(7);
    });

    it('two optional arguments and one required argument', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [
            Tailored.variable(null, 3),
            Tailored.variable(),
            Tailored.variable(null, 2)
          ],
          (arg1, arg2, arg3) => arg1 + arg2 + arg3
        )
      );

      expect(fn(1)).to.equal(6);
      expect(fn(3, 4)).to.equal(9);
    });

    it('two optional arguments in between 2 required', () => {
      let fn = Tailored.defmatch(
        Tailored.clause(
          [
            Tailored.variable(),
            Tailored.variable(null, 2),
            Tailored.variable(null, 3),
            Tailored.variable()
          ],
          (arg1, arg2, arg3, arg4) => arg1 + arg2 + arg3 + arg4
        )
      );

      expect(fn(1, 4)).to.equal(10);
      expect(fn(1, 5, 4)).to.equal(13);
      expect(fn(1, 5, 7, 4)).to.equal(17);
    });

    it('must match on objects with symbol keys', () => {
      const bound_value = {
        [Symbol.for('__struct__')]: Symbol.for('Elixir.Blueprint.AssertError')
      };

      const value = {
        [Symbol.for('__struct__')]: Symbol.for('Elixir.Blueprint.AssertError'),
        [Symbol.for('msg')]: 'somthing'
      };

      let fn = Tailored.defmatch(
        Tailored.clause([Tailored.capture(bound_value)], val => true)
      );

      expect(fn(value)).to.equal(true);
    });

    it('must match on maps with symbol keys', () => {
      const bound_value = new Map([
        [Symbol.for('__struct__'), Symbol.for('Elixir.Blueprint.AssertError')]
      ]);

      const value = new Map([
        [Symbol.for('__struct__'), Symbol.for('Elixir.Blueprint.AssertError')],
        [Symbol.for('msg'), 'something']
      ]);

      let fn = Tailored.defmatch(
        Tailored.clause([Tailored.capture(bound_value)], val => true)
      );

      expect(fn(value)).to.equal(true);
    });
  });
});
