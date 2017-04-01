'use strict';

import chai from 'chai';
var expect = chai.expect;

import Tailored from '../src/index.js';
import ErlangTypes from 'erlang-types';

const _ = Tailored.wildcard();
const $ = Tailored.variable();

describe('tailcall', () => {
  it('factorial must work correctly', () => {
    let fact = Tailored.defmatch(
      Tailored.clause([0], () => 1),
      Tailored.clause([$], n => n * fact(n - 1)),
    );

    //let response = fact(32768);
    //expect(response).to.equal(Infinity);
  });
});
