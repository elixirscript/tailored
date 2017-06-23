'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ErlangTypes = _interopDefault(require('erlang-types'));

/* @flow */

class Variable {

  constructor(default_value = Symbol.for("tailored.no_value")) {
    this.default_value = default_value;
  }
}

class Wildcard {
  constructor() {}
}

class StartsWith {

  constructor(prefix) {
    this.prefix = prefix;
  }
}

class Capture {

  constructor(value) {
    this.value = value;
  }
}

class HeadTail {
  constructor() {}
}

class Type {

  constructor(type, objPattern = {}) {
    this.type = type;
    this.objPattern = objPattern;
  }
}

class Bound {

  constructor(value) {
    this.value = value;
  }
}

class BitStringMatch {

  constructor(...values) {
    this.values = values;
  }

  length() {
    return values.length;
  }

  bit_size() {
    return this.byte_size() * 8;
  }

  byte_size() {
    let s = 0;

    for (let val of this.values) {
      s = s + val.unit * val.size / 8;
    }

    return s;
  }

  getValue(index) {
    return this.values(index);
  }

  getSizeOfValue(index) {
    let val = this.getValue(index);
    return val.unit * val.size;
  }

  getTypeOfValue(index) {
    return this.getValue(index).type;
  }
}

function variable(default_value = Symbol.for("tailored.no_value")) {
  return new Variable(default_value);
}

function wildcard() {
  return new Wildcard();
}

function startsWith(prefix) {
  return new StartsWith(prefix);
}

function capture(value) {
  return new Capture(value);
}

function headTail() {
  return new HeadTail();
}

function type(type, objPattern = {}) {
  return new Type(type, objPattern);
}

function bound(value) {
  return new Bound(value);
}

function bitStringMatch(...values) {
  return new BitStringMatch(...values);
}

/* @flow */

function is_number(value) {
  return typeof value === 'number';
}

function is_string(value) {
  return typeof value === 'string';
}

function is_boolean(value) {
  return typeof value === 'boolean';
}

function is_symbol(value) {
  return typeof value === 'symbol';
}

function is_object(value) {
  return typeof value === 'object';
}

function is_variable(value) {
  return value instanceof Variable;
}

function is_null(value) {
  return value === null;
}

function is_array(value) {
  return Array.isArray(value);
}

function is_function(value) {
  return Object.prototype.toString.call(value) == '[object Function]';
}

/* @flow */

const BitString = ErlangTypes.BitString;

function resolveSymbol(pattern) {
  return function (value) {
    return is_symbol(value) && value === pattern;
  };
}

function resolveString(pattern) {
  return function (value) {
    return is_string(value) && value === pattern;
  };
}

function resolveNumber(pattern) {
  return function (value) {
    return is_number(value) && value === pattern;
  };
}

function resolveBoolean(pattern) {
  return function (value) {
    return is_boolean(value) && value === pattern;
  };
}

function resolveFunction(pattern) {
  return function (value) {
    return is_function(value) && value === pattern;
  };
}

function resolveNull(pattern) {
  return function (value) {
    return is_null(value);
  };
}

function resolveBound(pattern) {
  return function (value, args) {
    if (typeof value === typeof pattern.value && value === pattern.value) {
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveWildcard() {
  return function () {
    return true;
  };
}

function resolveVariable() {
  return function (value, args) {
    args.push(value);
    return true;
  };
}

function resolveHeadTail() {
  return function (value, args) {
    if (!is_array(value) || value.length < 2) {
      return false;
    }

    const head = value[0];
    const tail = value.slice(1);

    args.push(head);
    args.push(tail);

    return true;
  };
}

function resolveCapture(pattern) {
  const matches = buildMatch(pattern.value);

  return function (value, args) {
    if (matches(value, args)) {
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveStartsWith(pattern) {
  const prefix = pattern.prefix;

  return function (value, args) {
    if (is_string(value) && value.startsWith(prefix)) {
      args.push(value.substring(prefix.length));
      return true;
    }

    return false;
  };
}

function resolveType(pattern) {
  return function (value, args) {
    if (value instanceof pattern.type) {
      const matches = buildMatch(pattern.objPattern);
      return matches(value, args) && args.push(value) > 0;
    }

    return false;
  };
}

function resolveArray(pattern) {
  const matches = pattern.map(x => buildMatch(x));

  return function (value, args) {
    if (!is_array(value) || value.length != pattern.length) {
      return false;
    }

    return value.every(function (v, i) {
      return matches[i](value[i], args);
    });
  };
}

function resolveObject(pattern) {
  let matches = {};

  const keys = Object.keys(pattern).concat(Object.getOwnPropertySymbols(pattern));

  for (let key of keys) {
    matches[key] = buildMatch(pattern[key]);
  }

  return function (value, args) {
    if (!is_object(value) || pattern.length > value.length) {
      return false;
    }

    for (let key of keys) {
      if (!(key in value) || !matches[key](value[key], args)) {
        return false;
      }
    }

    return true;
  };
}

function resolveBitString(pattern) {
  let patternBitString = [];

  for (let bitstringMatchPart of pattern.values) {
    if (is_variable(bitstringMatchPart.value)) {
      let size = getSize(bitstringMatchPart.unit, bitstringMatchPart.size);
      fillArray(patternBitString, size);
    } else {
      patternBitString = patternBitString.concat(new BitString(bitstringMatchPart).value);
    }
  }

  let patternValues = pattern.values;

  return function (value, args) {
    let bsValue = null;

    if (!is_string(value) && !(value instanceof BitString)) {
      return false;
    }

    if (is_string(value)) {
      bsValue = new BitString(BitString.binary(value));
    } else {
      bsValue = value;
    }

    let beginningIndex = 0;

    for (let i = 0; i < patternValues.length; i++) {
      let bitstringMatchPart = patternValues[i];

      if (is_variable(bitstringMatchPart.value) && bitstringMatchPart.type == 'binary' && bitstringMatchPart.size === undefined && i < patternValues.length - 1) {
        throw new Error('a binary field without size is only allowed at the end of a binary pattern');
      }

      let size = 0;
      let bsValueArrayPart = [];
      let patternBitStringArrayPart = [];
      size = getSize(bitstringMatchPart.unit, bitstringMatchPart.size);

      if (i === patternValues.length - 1) {
        bsValueArrayPart = bsValue.value.slice(beginningIndex);
        patternBitStringArrayPart = patternBitString.slice(beginningIndex);
      } else {
        bsValueArrayPart = bsValue.value.slice(beginningIndex, beginningIndex + size);
        patternBitStringArrayPart = patternBitString.slice(beginningIndex, beginningIndex + size);
      }

      if (is_variable(bitstringMatchPart.value)) {
        switch (bitstringMatchPart.type) {
          case 'integer':
            if (bitstringMatchPart.attributes && bitstringMatchPart.attributes.indexOf('signed') != -1) {
              args.push(new Int8Array([bsValueArrayPart[0]])[0]);
            } else {
              args.push(new Uint8Array([bsValueArrayPart[0]])[0]);
            }
            break;

          case 'float':
            if (size === 64) {
              args.push(Float64Array.from(bsValueArrayPart)[0]);
            } else if (size === 32) {
              args.push(Float32Array.from(bsValueArrayPart)[0]);
            } else {
              return false;
            }
            break;

          case 'bitstring':
            args.push(createBitString(bsValueArrayPart));
            break;

          case 'binary':
            args.push(String.fromCharCode.apply(null, new Uint8Array(bsValueArrayPart)));
            break;

          case 'utf8':
            args.push(String.fromCharCode.apply(null, new Uint8Array(bsValueArrayPart)));
            break;

          case 'utf16':
            args.push(String.fromCharCode.apply(null, new Uint16Array(bsValueArrayPart)));
            break;

          case 'utf32':
            args.push(String.fromCharCode.apply(null, new Uint32Array(bsValueArrayPart)));
            break;

          default:
            return false;
        }
      } else if (!arraysEqual(bsValueArrayPart, patternBitStringArrayPart)) {
        return false;
      }

      beginningIndex = beginningIndex + size;
    }

    return true;
  };
}

function getSize(unit, size) {
  return unit * size / 8;
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

function fillArray(arr, num) {
  for (let i = 0; i < num; i++) {
    arr.push(0);
  }
}

function createBitString(arr) {
  let integerParts = arr.map(elem => BitString.integer(elem));
  return new BitString(...integerParts);
}

function resolveNoMatch() {
  return function () {
    return false;
  };
}

const patternMap = new Map();
patternMap.set(Variable.prototype, resolveVariable);
patternMap.set(Wildcard.prototype, resolveWildcard);
patternMap.set(HeadTail.prototype, resolveHeadTail);
patternMap.set(StartsWith.prototype, resolveStartsWith);
patternMap.set(Capture.prototype, resolveCapture);
patternMap.set(Bound.prototype, resolveBound);
patternMap.set(Type.prototype, resolveType);
patternMap.set(BitStringMatch.prototype, resolveBitString);
patternMap.set(Number.prototype, resolveNumber);
patternMap.set(Symbol.prototype, resolveSymbol);
patternMap.set(Array.prototype, resolveArray);
patternMap.set(String.prototype, resolveString);
patternMap.set(Boolean.prototype, resolveBoolean);
patternMap.set(Function.prototype, resolveFunction);
patternMap.set(Object.prototype, resolveObject);

function buildMatch(pattern) {
  if (pattern === null) {
    return resolveNull(pattern);
  }

  if (typeof pattern === 'undefined') {
    return resolveWildcard(pattern);
  }

  const type$$1 = pattern.constructor.prototype;
  const resolver = patternMap.get(type$$1);

  if (resolver) {
    return resolver(pattern);
  }

  if (typeof pattern === 'object') {
    return resolveObject(pattern);
  }

  return resolveNoMatch();
}

class MatchError extends Error {
  constructor(arg) {
    super();

    if (typeof arg === 'symbol') {
      this.message = 'No match for: ' + arg.toString();
    } else if (Array.isArray(arg)) {
      let mappedValues = arg.map(x => x.toString());
      this.message = 'No match for: ' + mappedValues;
    } else {
      this.message = 'No match for: ' + arg;
    }

    this.stack = new Error().stack;
    this.name = this.constructor.name;
  }
}

class Clause {
  constructor(pattern, fn, guard = () => true) {
    this.pattern = buildMatch(pattern);
    this.arity = pattern.length;
    this.optionals = getOptionalValues(pattern);
    this.fn = fn;
    this.guard = guard;
  }
}

function clause(pattern, fn, guard = () => true) {
  return new Clause(pattern, fn, guard);
}



function defmatch(...clauses) {
  const arities = getArityMap(clauses);

  return function (...args) {
    let [funcToCall, params] = findMatchingFunction(args, arities);
    return funcToCall.apply(this, params);
  };
}

function defmatchgen(...clauses) {
  const arities = getArityMap(clauses);

  return function* (...args) {
    let [funcToCall, params] = findMatchingFunction(args, arities);
    return yield* funcToCall.apply(this, params);
  };
}

function defmatchGen(...args) {
  return defmatchgen(...args);
}

function defmatchAsync(...clauses) {
  const arities = getArityMap(clauses);

  return async function (...args) {
    if (arities.has(args.length)) {
      const arityClauses = arities.get(args.length);

      let funcToCall = null;
      let params = null;
      for (let processedClause of arityClauses) {
        let result = [];
        args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

        if (processedClause.pattern(args, result) && (await processedClause.guard.apply(this, result))) {
          funcToCall = processedClause.fn;
          params = result;
          break;
        }
      }

      if (!funcToCall) {
        console.error('No match for:', args);
        throw new MatchError(args);
      }

      return funcToCall.apply(this, params);
    } else {
      console.error('Arity of', args.length, 'not found. No match for:', args);
      throw new MatchError(args);
    }
  };
}

function findMatchingFunction(args, arities) {
  if (arities.has(args.length)) {
    const arityClauses = arities.get(args.length);

    let funcToCall = null;
    let params = null;
    for (let processedClause of arityClauses) {
      let result = [];
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        funcToCall = processedClause.fn;
        params = result;
        break;
      }
    }

    if (!funcToCall) {
      console.error('No match for:', args);
      throw new MatchError(args);
    }

    return [funcToCall, params];
  } else {
    console.error('Arity of', args.length, 'not found. No match for:', args);
    throw new MatchError(args);
  }
}

function getArityMap(clauses) {
  let map = new Map();

  for (const clause of clauses) {
    const range = getArityRange(clause);

    for (const arity of range) {
      let arityClauses = [];

      if (map.has(arity)) {
        arityClauses = map.get(arity);
      }

      arityClauses.push(clause);
      map.set(arity, arityClauses);
    }
  }

  return map;
}

function getArityRange(clause) {
  const min = clause.arity - clause.optionals.length;
  const max = clause.arity;

  let range = [min];

  while (range[range.length - 1] != max) {
    range.push(range[range.length - 1] + 1);
  }

  return range;
}

function getOptionalValues(pattern) {
  let optionals = [];

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] instanceof Variable && pattern[i].default_value != Symbol.for('tailored.no_value')) {
      optionals.push([i, pattern[i].default_value]);
    }
  }

  return optionals;
}

function fillInOptionalValues(args, arity, optionals) {
  if (args.length === arity || optionals.length === 0) {
    return args;
  }

  if (args.length + optionals.length < arity) {
    return args;
  }

  let numberOfOptionalsToFill = arity - args.length;
  let optionalsToRemove = optionals.length - numberOfOptionalsToFill;

  let optionalsToUse = optionals.slice(optionalsToRemove);

  for (let [index, value] of optionalsToUse) {
    args.splice(index, 0, value);
    if (args.length === arity) {
      break;
    }
  }

  return args;
}

function match(pattern, expr, guard = () => true) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)) {
    return result;
  } else {
    console.error('No match for:', expr);
    throw new MatchError(expr);
  }
}

function match_or_default(pattern, expr, guard = () => true, default_value = null) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)) {
    return result;
  } else {
    return default_value;
  }
}

const NO_MATCH = Symbol();

function bitstring_generator(pattern, bitstring) {
  return function () {
    let returnResult = [];
    let bsSlice = bitstring.slice(0, pattern.byte_size());
    let i = 1;

    while (bsSlice.byte_size == pattern.byte_size()) {
      const result = match_or_default(pattern, bsSlice, () => true, NO_MATCH);

      if (result != NO_MATCH) {
        const [value] = result;
        returnResult.push(result);
      }

      bsSlice = bitstring.slice(pattern.byte_size() * i, pattern.byte_size() * (i + 1));

      i++;
    }

    return returnResult;
  };
}

function list_generator(pattern, list) {
  return function () {
    let returnResult = [];
    for (let i of list) {
      const result = match_or_default(pattern, i, () => true, NO_MATCH);
      if (result != NO_MATCH) {
        const [value] = result;
        returnResult.push(value);
      }
    }

    return returnResult;
  };
}

function list_comprehension(expression, generators) {
  const generatedValues = run_generators(generators.pop()(), generators);

  let result = [];

  for (let value of generatedValues) {
    if (expression.guard.apply(this, value)) {
      result.push(expression.fn.apply(this, value));
    }
  }

  return result;
}

function run_generators(generator, generators) {
  if (generators.length == 0) {
    return generator.map(x => {
      if (Array.isArray(x)) {
        return x;
      } else {
        return [x];
      }
    });
  } else {
    const list = generators.pop();

    let next_gen = [];
    for (let j of list()) {
      for (let i of generator) {
        next_gen.push([j].concat(i));
      }
    }

    return run_generators(next_gen, generators);
  }
}

function bitstring_comprehension(expression, generators) {
  const generatedValues = run_generators(generators.pop()(), generators);

  let result = [];

  for (let value of generatedValues) {
    if (expression.guard.apply(this, value)) {
      result.push(expression.fn.apply(this, value));
    }
  }

  result = result.map(x => ErlangTypes.BitString.integer(x));
  return new ErlangTypes.BitString(...result);
}

var index = {
  defmatch,
  match,
  MatchError,
  variable,
  wildcard,
  startsWith,
  capture,
  headTail,
  type,
  bound,
  Clause,
  clause,
  bitStringMatch,
  match_or_default,
  defmatchgen,
  list_comprehension,
  list_generator,
  bitstring_generator,
  bitstring_comprehension,
  defmatchGen,
  defmatchAsync
};

module.exports = index;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdHlwZXMnO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbn1cblxuZnVuY3Rpb24gaXNfYm9vbGVhbih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbic7XG59XG5cbmZ1bmN0aW9uIGlzX3N5bWJvbCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3ltYm9sJztcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19vYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCc7XG59XG5cbmZ1bmN0aW9uIGlzX3ZhcmlhYmxlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFZhcmlhYmxlO1xufVxuXG5mdW5jdGlvbiBpc193aWxkY2FyZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBXaWxkY2FyZDtcbn1cblxuZnVuY3Rpb24gaXNfaGVhZFRhaWwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSGVhZFRhaWw7XG59XG5cbmZ1bmN0aW9uIGlzX2NhcHR1cmUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQ2FwdHVyZTtcbn1cblxuZnVuY3Rpb24gaXNfdHlwZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBUeXBlO1xufVxuXG5mdW5jdGlvbiBpc19zdGFydHNXaXRoKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFN0YXJ0c1dpdGg7XG59XG5cbmZ1bmN0aW9uIGlzX2JvdW5kKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJvdW5kO1xufVxuXG5mdW5jdGlvbiBpc19iaXRzdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nTWF0Y2g7XG59XG5cbmZ1bmN0aW9uIGlzX251bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2Z1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbmV4cG9ydCB7XG4gIGlzX251bWJlcixcbiAgaXNfc3RyaW5nLFxuICBpc19ib29sZWFuLFxuICBpc19zeW1ib2wsXG4gIGlzX251bGwsXG4gIGlzX3VuZGVmaW5lZCxcbiAgaXNfZnVuY3Rpb24sXG4gIGlzX3ZhcmlhYmxlLFxuICBpc193aWxkY2FyZCxcbiAgaXNfaGVhZFRhaWwsXG4gIGlzX2NhcHR1cmUsXG4gIGlzX3R5cGUsXG4gIGlzX3N0YXJ0c1dpdGgsXG4gIGlzX2JvdW5kLFxuICBpc19vYmplY3QsXG4gIGlzX2FycmF5LFxuICBpc19iaXRzdHJpbmcsXG59O1xuIiwiLyogQGZsb3cgKi9cblxuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gJy4vY2hlY2tzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gJ2VybGFuZy10eXBlcyc7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdW1iZXIocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19mdW5jdGlvbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdWxsKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVXaWxkY2FyZCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVmFyaWFibGUoKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVIZWFkVGFpbCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCA8IDIpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgYXJncy5wdXNoKGhlYWQpO1xuICAgIGFyZ3MucHVzaCh0YWlsKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChtYXRjaGVzKHZhbHVlLCBhcmdzKSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0YXJ0c1dpdGgocGF0dGVybikge1xuICBjb25zdCBwcmVmaXggPSBwYXR0ZXJuLnByZWZpeDtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVR5cGUocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuLnR5cGUpIHtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncykgJiYgYXJncy5wdXNoKHZhbHVlKSA+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoICE9IHBhdHRlcm4ubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlLmV2ZXJ5KGZ1bmN0aW9uKHYsIGkpIHtcbiAgICAgIHJldHVybiBtYXRjaGVzW2ldKHZhbHVlW2ldLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU9iamVjdChwYXR0ZXJuKSB7XG4gIGxldCBtYXRjaGVzID0ge307XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pLFxuICApO1xuXG4gIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfb2JqZWN0KHZhbHVlKSB8fCBwYXR0ZXJuLmxlbmd0aCA+IHZhbHVlLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgICBpZiAoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IgKGxldCBiaXRzdHJpbmdNYXRjaFBhcnQgb2YgcGF0dGVybi52YWx1ZXMpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpIHtcbiAgICAgIGxldCBzaXplID0gZ2V0U2l6ZShiaXRzdHJpbmdNYXRjaFBhcnQudW5pdCwgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUpO1xuICAgICAgZmlsbEFycmF5KHBhdHRlcm5CaXRTdHJpbmcsIHNpemUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQoXG4gICAgICAgIG5ldyBCaXRTdHJpbmcoYml0c3RyaW5nTWF0Y2hQYXJ0KS52YWx1ZSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHBhdHRlcm5WYWx1ZXMgPSBwYXR0ZXJuLnZhbHVlcztcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBsZXQgYnNWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoIUNoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKSB7XG4gICAgICBic1ZhbHVlID0gbmV3IEJpdFN0cmluZyhCaXRTdHJpbmcuYmluYXJ5KHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0ID0gcGF0dGVyblZhbHVlc1tpXTtcblxuICAgICAgaWYgKFxuICAgICAgICBDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgIGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDFcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ2EgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHNpemUgPSAwO1xuICAgICAgbGV0IGJzVmFsdWVBcnJheVBhcnQgPSBbXTtcbiAgICAgIGxldCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gW107XG4gICAgICBzaXplID0gZ2V0U2l6ZShiaXRzdHJpbmdNYXRjaFBhcnQudW5pdCwgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUpO1xuXG4gICAgICBpZiAoaSA9PT0gcGF0dGVyblZhbHVlcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXgsXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXggKyBzaXplLFxuICAgICAgICApO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemUsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSkge1xuICAgICAgICBzd2l0Y2ggKGJpdHN0cmluZ01hdGNoUGFydC50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzICYmXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzLmluZGV4T2YoJ3NpZ25lZCcpICE9IC0xXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBJbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIGlmIChzaXplID09PSA2NCkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzaXplID09PSAzMikge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgICAgYXJncy5wdXNoKGNyZWF0ZUJpdFN0cmluZyhic1ZhbHVlQXJyYXlQYXJ0KSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmOCc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmMTYnOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgbmV3IFVpbnQxNkFycmF5KGJzVmFsdWVBcnJheVBhcnQpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmMzInOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghYXJyYXlzRXF1YWwoYnNWYWx1ZUFycmF5UGFydCwgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBiZWdpbm5pbmdJbmRleCA9IGJlZ2lubmluZ0luZGV4ICsgc2l6ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2l6ZSh1bml0LCBzaXplKSB7XG4gIHJldHVybiB1bml0ICogc2l6ZSAvIDg7XG59XG5cbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoYS5sZW5ndGggIT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxBcnJheShhcnIsIG51bSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgYXJyLnB1c2goMCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQml0U3RyaW5nKGFycikge1xuICBsZXQgaW50ZWdlclBhcnRzID0gYXJyLm1hcChlbGVtID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmcsXG59O1xuIiwiaW1wb3J0ICogYXMgUmVzb2x2ZXJzIGZyb20gJy4vcmVzb2x2ZXJzJztcbmltcG9ydCB7XG4gIFZhcmlhYmxlLFxuICBXaWxkY2FyZCxcbiAgSGVhZFRhaWwsXG4gIENhcHR1cmUsXG4gIFR5cGUsXG4gIFN0YXJ0c1dpdGgsXG4gIEJvdW5kLFxuICBCaXRTdHJpbmdNYXRjaCxcbn0gZnJvbSAnLi90eXBlcyc7XG5cbmNvbnN0IHBhdHRlcm5NYXAgPSBuZXcgTWFwKCk7XG5wYXR0ZXJuTWFwLnNldChWYXJpYWJsZS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlVmFyaWFibGUpO1xucGF0dGVybk1hcC5zZXQoV2lsZGNhcmQucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVdpbGRjYXJkKTtcbnBhdHRlcm5NYXAuc2V0KEhlYWRUYWlsLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVIZWFkVGFpbCk7XG5wYXR0ZXJuTWFwLnNldChTdGFydHNXaXRoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTdGFydHNXaXRoKTtcbnBhdHRlcm5NYXAuc2V0KENhcHR1cmUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUNhcHR1cmUpO1xucGF0dGVybk1hcC5zZXQoQm91bmQucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvdW5kKTtcbnBhdHRlcm5NYXAuc2V0KFR5cGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVR5cGUpO1xucGF0dGVybk1hcC5zZXQoQml0U3RyaW5nTWF0Y2gucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJpdFN0cmluZyk7XG5wYXR0ZXJuTWFwLnNldChOdW1iZXIucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZU51bWJlcik7XG5wYXR0ZXJuTWFwLnNldChTeW1ib2wucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVN5bWJvbCk7XG5wYXR0ZXJuTWFwLnNldChBcnJheS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQXJyYXkpO1xucGF0dGVybk1hcC5zZXQoU3RyaW5nLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoQm9vbGVhbi5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQm9vbGVhbik7XG5wYXR0ZXJuTWFwLnNldChGdW5jdGlvbi5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlRnVuY3Rpb24pO1xucGF0dGVybk1hcC5zZXQoT2JqZWN0LnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QpO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG4gIGlmIChwYXR0ZXJuID09PSBudWxsKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlTnVsbChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGNvbnN0IHR5cGUgPSBwYXR0ZXJuLmNvbnN0cnVjdG9yLnByb3RvdHlwZTtcbiAgY29uc3QgcmVzb2x2ZXIgPSBwYXR0ZXJuTWFwLmdldCh0eXBlKTtcblxuICBpZiAocmVzb2x2ZXIpIHtcbiAgICByZXR1cm4gcmVzb2x2ZXIocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlT2JqZWN0KHBhdHRlcm4pO1xuICB9XG5cbiAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlTm9NYXRjaCgpO1xufVxuIiwiaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi90eXBlcyc7XG5cbmNvbnN0IEZVTkMgPSBTeW1ib2woKTtcblxuZXhwb3J0IGNsYXNzIE1hdGNoRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGFyZykge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcpIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBhcmcudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICAgbGV0IG1hcHBlZFZhbHVlcyA9IGFyZy5tYXAoeCA9PiB4LnRvU3RyaW5nKCkpO1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIG1hcHBlZFZhbHVlcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZztcbiAgICB9XG5cbiAgICB0aGlzLnN0YWNrID0gbmV3IEVycm9yKCkuc3RhY2s7XG4gICAgdGhpcy5uYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGF1c2Uge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgICB0aGlzLmFyaXR5ID0gcGF0dGVybi5sZW5ndGg7XG4gICAgdGhpcy5vcHRpb25hbHMgPSBnZXRPcHRpb25hbFZhbHVlcyhwYXR0ZXJuKTtcbiAgICB0aGlzLmZuID0gZm47XG4gICAgdGhpcy5ndWFyZCA9IGd1YXJkO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGF1c2UocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICByZXR1cm4gbmV3IENsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbXBvbGluZShmbikge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJlcyA9IGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgd2hpbGUgKHJlcyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXMgPSByZXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoZ2VuKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBmdW5jdGlvbiooLi4uYXJncykge1xuICAgIGxldCBbZnVuY1RvQ2FsbCwgcGFyYW1zXSA9IGZpbmRNYXRjaGluZ0Z1bmN0aW9uKGFyZ3MsIGFyaXRpZXMpO1xuICAgIHJldHVybiB5aWVsZCogZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hHZW4oLi4uYXJncykge1xuICByZXR1cm4gZGVmbWF0Y2hnZW4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEFzeW5jKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBhc3luYyBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgaWYgKGFyaXRpZXMuaGFzKGFyZ3MubGVuZ3RoKSkge1xuICAgICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgICAgYXJncyxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFscyxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KSAmJlxuICAgICAgICAgIChhd2FpdCBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcykge1xuICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgbGV0IGZ1bmNUb0NhbGwgPSBudWxsO1xuICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgYXJncyxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmFyaXR5LFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzLFxuICAgICAgKTtcblxuICAgICAgaWYgKFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpICYmXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5ndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpXG4gICAgICApIHtcbiAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgcGFyYW1zID0gcmVzdWx0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWZ1bmNUb0NhbGwpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBbZnVuY1RvQ2FsbCwgcGFyYW1zXTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdBcml0eSBvZicsIGFyZ3MubGVuZ3RoLCAnbm90IGZvdW5kLiBObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QXJpdHlNYXAoY2xhdXNlcykge1xuICBsZXQgbWFwID0gbmV3IE1hcCgpO1xuXG4gIGZvciAoY29uc3QgY2xhdXNlIG9mIGNsYXVzZXMpIHtcbiAgICBjb25zdCByYW5nZSA9IGdldEFyaXR5UmFuZ2UoY2xhdXNlKTtcblxuICAgIGZvciAoY29uc3QgYXJpdHkgb2YgcmFuZ2UpIHtcbiAgICAgIGxldCBhcml0eUNsYXVzZXMgPSBbXTtcblxuICAgICAgaWYgKG1hcC5oYXMoYXJpdHkpKSB7XG4gICAgICAgIGFyaXR5Q2xhdXNlcyA9IG1hcC5nZXQoYXJpdHkpO1xuICAgICAgfVxuXG4gICAgICBhcml0eUNsYXVzZXMucHVzaChjbGF1c2UpO1xuICAgICAgbWFwLnNldChhcml0eSwgYXJpdHlDbGF1c2VzKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWFwO1xufVxuXG5mdW5jdGlvbiBnZXRBcml0eVJhbmdlKGNsYXVzZSkge1xuICBjb25zdCBtaW4gPSBjbGF1c2UuYXJpdHkgLSBjbGF1c2Uub3B0aW9uYWxzLmxlbmd0aDtcbiAgY29uc3QgbWF4ID0gY2xhdXNlLmFyaXR5O1xuXG4gIGxldCByYW5nZSA9IFttaW5dO1xuXG4gIHdoaWxlIChyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSAhPSBtYXgpIHtcbiAgICByYW5nZS5wdXNoKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICsgMSk7XG4gIH1cblxuICByZXR1cm4gcmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pIHtcbiAgbGV0IG9wdGlvbmFscyA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGg7IGkrKykge1xuICAgIGlmIChcbiAgICAgIHBhdHRlcm5baV0gaW5zdGFuY2VvZiBUeXBlcy5WYXJpYWJsZSAmJlxuICAgICAgcGF0dGVybltpXS5kZWZhdWx0X3ZhbHVlICE9IFN5bWJvbC5mb3IoJ3RhaWxvcmVkLm5vX3ZhbHVlJylcbiAgICApIHtcbiAgICAgIG9wdGlvbmFscy5wdXNoKFtpLCBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWVdKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3B0aW9uYWxzO1xufVxuXG5mdW5jdGlvbiBmaWxsSW5PcHRpb25hbFZhbHVlcyhhcmdzLCBhcml0eSwgb3B0aW9uYWxzKSB7XG4gIGlmIChhcmdzLmxlbmd0aCA9PT0gYXJpdHkgfHwgb3B0aW9uYWxzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgaWYgKGFyZ3MubGVuZ3RoICsgb3B0aW9uYWxzLmxlbmd0aCA8IGFyaXR5KSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBsZXQgbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwgPSBhcml0eSAtIGFyZ3MubGVuZ3RoO1xuICBsZXQgb3B0aW9uYWxzVG9SZW1vdmUgPSBvcHRpb25hbHMubGVuZ3RoIC0gbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGw7XG5cbiAgbGV0IG9wdGlvbmFsc1RvVXNlID0gb3B0aW9uYWxzLnNsaWNlKG9wdGlvbmFsc1RvUmVtb3ZlKTtcblxuICBmb3IgKGxldCBbaW5kZXgsIHZhbHVlXSBvZiBvcHRpb25hbHNUb1VzZSkge1xuICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAwLCB2YWx1ZSk7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFyZ3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaChwYXR0ZXJuLCBleHByLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGlmIChwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCkgJiYgZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGV4cHIpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGV4cHIpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaF9vcl9kZWZhdWx0KFxuICBwYXR0ZXJuLFxuICBleHByLFxuICBndWFyZCA9ICgpID0+IHRydWUsXG4gIGRlZmF1bHRfdmFsdWUgPSBudWxsLFxuKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBpZiAocHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpICYmIGd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdCkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG4iLCJpbXBvcnQgeyBtYXRjaF9vcl9kZWZhdWx0IH0gZnJvbSBcIi4vZGVmbWF0Y2hcIjtcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tIFwiZXJsYW5nLXR5cGVzXCI7XG5cbmNvbnN0IE5PX01BVENIID0gU3ltYm9sKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaXRzdHJpbmdfZ2VuZXJhdG9yKHBhdHRlcm4sIGJpdHN0cmluZykge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJldHVyblJlc3VsdCA9IFtdO1xuICAgIGxldCBic1NsaWNlID0gYml0c3RyaW5nLnNsaWNlKDAsIHBhdHRlcm4uYnl0ZV9zaXplKCkpO1xuICAgIGxldCBpID0gMTtcblxuICAgIHdoaWxlIChic1NsaWNlLmJ5dGVfc2l6ZSA9PSBwYXR0ZXJuLmJ5dGVfc2l6ZSgpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaF9vcl9kZWZhdWx0KHBhdHRlcm4sIGJzU2xpY2UsICgpID0+IHRydWUsIE5PX01BVENIKTtcblxuICAgICAgaWYgKHJlc3VsdCAhPSBOT19NQVRDSCkge1xuICAgICAgICBjb25zdCBbdmFsdWVdID0gcmVzdWx0O1xuICAgICAgICByZXR1cm5SZXN1bHQucHVzaChyZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICBic1NsaWNlID0gYml0c3RyaW5nLnNsaWNlKFxuICAgICAgICBwYXR0ZXJuLmJ5dGVfc2l6ZSgpICogaSxcbiAgICAgICAgcGF0dGVybi5ieXRlX3NpemUoKSAqIChpICsgMSlcbiAgICAgICk7XG5cbiAgICAgIGkrKztcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0dXJuUmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdF9nZW5lcmF0b3IocGF0dGVybiwgbGlzdCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJldHVyblJlc3VsdCA9IFtdO1xuICAgIGZvciAobGV0IGkgb2YgbGlzdCkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBpLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmV0dXJuUmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdF9jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9ycy5wb3AoKSgpLCBnZW5lcmF0b3JzKTtcblxuICBsZXQgcmVzdWx0ID0gW107XG5cbiAgZm9yIChsZXQgdmFsdWUgb2YgZ2VuZXJhdGVkVmFsdWVzKSB7XG4gICAgaWYgKGV4cHJlc3Npb24uZ3VhcmQuYXBwbHkodGhpcywgdmFsdWUpKSB7XG4gICAgICByZXN1bHQucHVzaChleHByZXNzaW9uLmZuLmFwcGx5KHRoaXMsIHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9yLCBnZW5lcmF0b3JzKSB7XG4gIGlmIChnZW5lcmF0b3JzLmxlbmd0aCA9PSAwKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvci5tYXAoeCA9PiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheSh4KSkge1xuICAgICAgICByZXR1cm4geDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbeF07XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbGlzdCA9IGdlbmVyYXRvcnMucG9wKCk7XG5cbiAgICBsZXQgbmV4dF9nZW4gPSBbXTtcbiAgICBmb3IgKGxldCBqIG9mIGxpc3QoKSkge1xuICAgICAgZm9yIChsZXQgaSBvZiBnZW5lcmF0b3IpIHtcbiAgICAgICAgbmV4dF9nZW4ucHVzaChbal0uY29uY2F0KGkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcnVuX2dlbmVyYXRvcnMobmV4dF9nZW4sIGdlbmVyYXRvcnMpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbihleHByZXNzaW9uLCBnZW5lcmF0b3JzKSB7XG4gIGNvbnN0IGdlbmVyYXRlZFZhbHVlcyA9IHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvcnMucG9wKCkoKSwgZ2VuZXJhdG9ycyk7XG5cbiAgbGV0IHJlc3VsdCA9IFtdO1xuXG4gIGZvciAobGV0IHZhbHVlIG9mIGdlbmVyYXRlZFZhbHVlcykge1xuICAgIGlmIChleHByZXNzaW9uLmd1YXJkLmFwcGx5KHRoaXMsIHZhbHVlKSkge1xuICAgICAgcmVzdWx0LnB1c2goZXhwcmVzc2lvbi5mbi5hcHBseSh0aGlzLCB2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHJlc3VsdCA9IHJlc3VsdC5tYXAoeCA9PiBFcmxhbmdUeXBlcy5CaXRTdHJpbmcuaW50ZWdlcih4KSk7XG4gIHJldHVybiBuZXcgRXJsYW5nVHlwZXMuQml0U3RyaW5nKC4uLnJlc3VsdCk7XG59XG4iLCJpbXBvcnQge1xuICBkZWZtYXRjaCxcbiAgbWF0Y2gsXG4gIE1hdGNoRXJyb3IsXG4gIENsYXVzZSxcbiAgY2xhdXNlLFxuICBtYXRjaF9vcl9kZWZhdWx0LFxuICBkZWZtYXRjaGdlbixcbiAgZGVmbWF0Y2hHZW4sXG4gIGRlZm1hdGNoQXN5bmMsXG59IGZyb20gJy4vdGFpbG9yZWQvZGVmbWF0Y2gnO1xuaW1wb3J0IHtcbiAgdmFyaWFibGUsXG4gIHdpbGRjYXJkLFxuICBzdGFydHNXaXRoLFxuICBjYXB0dXJlLFxuICBoZWFkVGFpbCxcbiAgdHlwZSxcbiAgYm91bmQsXG4gIGJpdFN0cmluZ01hdGNoLFxufSBmcm9tICcuL3RhaWxvcmVkL3R5cGVzJztcblxuaW1wb3J0IHtcbiAgbGlzdF9nZW5lcmF0b3IsXG4gIGxpc3RfY29tcHJlaGVuc2lvbixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb24sXG59IGZyb20gJy4vdGFpbG9yZWQvY29tcHJlaGVuc2lvbnMnO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgdmFyaWFibGUsXG4gIHdpbGRjYXJkLFxuICBzdGFydHNXaXRoLFxuICBjYXB0dXJlLFxuICBoZWFkVGFpbCxcbiAgdHlwZSxcbiAgYm91bmQsXG4gIENsYXVzZSxcbiAgY2xhdXNlLFxuICBiaXRTdHJpbmdNYXRjaCxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgZGVmbWF0Y2hnZW4sXG4gIGxpc3RfY29tcHJlaGVuc2lvbixcbiAgbGlzdF9nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uLFxuICBkZWZtYXRjaEdlbixcbiAgZGVmbWF0Y2hBc3luYyxcbn07XG4iXSwibmFtZXMiOlsiVmFyaWFibGUiLCJkZWZhdWx0X3ZhbHVlIiwiU3ltYm9sIiwiZm9yIiwiV2lsZGNhcmQiLCJTdGFydHNXaXRoIiwicHJlZml4IiwiQ2FwdHVyZSIsInZhbHVlIiwiSGVhZFRhaWwiLCJUeXBlIiwidHlwZSIsIm9ialBhdHRlcm4iLCJCb3VuZCIsIkJpdFN0cmluZ01hdGNoIiwidmFsdWVzIiwibGVuZ3RoIiwiYnl0ZV9zaXplIiwicyIsInZhbCIsInVuaXQiLCJzaXplIiwiaW5kZXgiLCJnZXRWYWx1ZSIsInZhcmlhYmxlIiwid2lsZGNhcmQiLCJzdGFydHNXaXRoIiwiY2FwdHVyZSIsImhlYWRUYWlsIiwiYm91bmQiLCJiaXRTdHJpbmdNYXRjaCIsImlzX251bWJlciIsImlzX3N0cmluZyIsImlzX2Jvb2xlYW4iLCJpc19zeW1ib2wiLCJpc19vYmplY3QiLCJpc192YXJpYWJsZSIsImlzX251bGwiLCJpc19hcnJheSIsIkFycmF5IiwiaXNBcnJheSIsImlzX2Z1bmN0aW9uIiwiT2JqZWN0IiwicHJvdG90eXBlIiwidG9TdHJpbmciLCJjYWxsIiwiQml0U3RyaW5nIiwiRXJsYW5nVHlwZXMiLCJyZXNvbHZlU3ltYm9sIiwicGF0dGVybiIsIkNoZWNrcyIsInJlc29sdmVTdHJpbmciLCJyZXNvbHZlTnVtYmVyIiwicmVzb2x2ZUJvb2xlYW4iLCJyZXNvbHZlRnVuY3Rpb24iLCJyZXNvbHZlTnVsbCIsInJlc29sdmVCb3VuZCIsImFyZ3MiLCJwdXNoIiwicmVzb2x2ZVdpbGRjYXJkIiwicmVzb2x2ZVZhcmlhYmxlIiwicmVzb2x2ZUhlYWRUYWlsIiwiaGVhZCIsInRhaWwiLCJzbGljZSIsInJlc29sdmVDYXB0dXJlIiwibWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJyZXNvbHZlU3RhcnRzV2l0aCIsInN1YnN0cmluZyIsInJlc29sdmVUeXBlIiwicmVzb2x2ZUFycmF5IiwibWFwIiwieCIsImV2ZXJ5IiwidiIsImkiLCJyZXNvbHZlT2JqZWN0Iiwia2V5cyIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsImtleSIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiZnJvbSIsIkZsb2F0MzJBcnJheSIsImNyZWF0ZUJpdFN0cmluZyIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImFwcGx5IiwiVWludDE2QXJyYXkiLCJVaW50MzJBcnJheSIsImFycmF5c0VxdWFsIiwiYSIsImIiLCJmaWxsQXJyYXkiLCJhcnIiLCJudW0iLCJpbnRlZ2VyUGFydHMiLCJlbGVtIiwiaW50ZWdlciIsInJlc29sdmVOb01hdGNoIiwicGF0dGVybk1hcCIsIk1hcCIsInNldCIsIlJlc29sdmVycyIsIk51bWJlciIsIkJvb2xlYW4iLCJGdW5jdGlvbiIsImNvbnN0cnVjdG9yIiwicmVzb2x2ZXIiLCJnZXQiLCJNYXRjaEVycm9yIiwiYXJnIiwibWVzc2FnZSIsIm1hcHBlZFZhbHVlcyIsInN0YWNrIiwibmFtZSIsIkNsYXVzZSIsImZuIiwiZ3VhcmQiLCJhcml0eSIsIm9wdGlvbmFscyIsImdldE9wdGlvbmFsVmFsdWVzIiwiY2xhdXNlIiwiZGVmbWF0Y2giLCJjbGF1c2VzIiwiYXJpdGllcyIsImdldEFyaXR5TWFwIiwiZnVuY1RvQ2FsbCIsInBhcmFtcyIsImZpbmRNYXRjaGluZ0Z1bmN0aW9uIiwiZGVmbWF0Y2hnZW4iLCJkZWZtYXRjaEdlbiIsImRlZm1hdGNoQXN5bmMiLCJoYXMiLCJhcml0eUNsYXVzZXMiLCJwcm9jZXNzZWRDbGF1c2UiLCJyZXN1bHQiLCJmaWxsSW5PcHRpb25hbFZhbHVlcyIsImVycm9yIiwicmFuZ2UiLCJnZXRBcml0eVJhbmdlIiwibWluIiwibWF4IiwiVHlwZXMiLCJudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCIsIm9wdGlvbmFsc1RvUmVtb3ZlIiwib3B0aW9uYWxzVG9Vc2UiLCJzcGxpY2UiLCJtYXRjaCIsImV4cHIiLCJwcm9jZXNzZWRQYXR0ZXJuIiwibWF0Y2hfb3JfZGVmYXVsdCIsIk5PX01BVENIIiwiYml0c3RyaW5nX2dlbmVyYXRvciIsImJpdHN0cmluZyIsInJldHVyblJlc3VsdCIsImJzU2xpY2UiLCJsaXN0X2dlbmVyYXRvciIsImxpc3QiLCJsaXN0X2NvbXByZWhlbnNpb24iLCJleHByZXNzaW9uIiwiZ2VuZXJhdG9ycyIsImdlbmVyYXRlZFZhbHVlcyIsInJ1bl9nZW5lcmF0b3JzIiwicG9wIiwiZ2VuZXJhdG9yIiwibmV4dF9nZW4iLCJqIiwiYml0c3RyaW5nX2NvbXByZWhlbnNpb24iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOztBQUVBLE1BQU1BLFFBQU4sQ0FBZTs7Y0FFREMsZ0JBQWdCQyxPQUFPQyxHQUFQLENBQVcsbUJBQVgsQ0FBNUIsRUFBNkQ7U0FDdERGLGFBQUwsR0FBcUJBLGFBQXJCOzs7O0FBSUosTUFBTUcsUUFBTixDQUFlO2dCQUNDOzs7QUFJaEIsTUFBTUMsVUFBTixDQUFpQjs7Y0FFSEMsTUFBWixFQUFvQjtTQUNiQSxNQUFMLEdBQWNBLE1BQWQ7Ozs7QUFJSixNQUFNQyxPQUFOLENBQWM7O2NBRUFDLEtBQVosRUFBbUI7U0FDWkEsS0FBTCxHQUFhQSxLQUFiOzs7O0FBSUosTUFBTUMsUUFBTixDQUFlO2dCQUNDOzs7QUFJaEIsTUFBTUMsSUFBTixDQUFXOztjQUVHQyxJQUFaLEVBQWtCQyxhQUFhLEVBQS9CLEVBQW1DO1NBQzVCRCxJQUFMLEdBQVlBLElBQVo7U0FDS0MsVUFBTCxHQUFrQkEsVUFBbEI7Ozs7QUFJSixNQUFNQyxLQUFOLENBQVk7O2NBRUVMLEtBQVosRUFBbUI7U0FDWkEsS0FBTCxHQUFhQSxLQUFiOzs7O0FBSUosTUFBTU0sY0FBTixDQUFxQjs7Y0FFUCxHQUFHQyxNQUFmLEVBQXNCO1NBQ2ZBLE1BQUwsR0FBY0EsTUFBZDs7O1dBR087V0FDQUEsT0FBT0MsTUFBZDs7O2FBR1M7V0FDRixLQUFLQyxTQUFMLEtBQW1CLENBQTFCOzs7Y0FHUztRQUNMQyxJQUFJLENBQVI7O1NBRUksSUFBSUMsR0FBUixJQUFlLEtBQUtKLE1BQXBCLEVBQTJCO1VBQ3JCRyxJQUFNQyxJQUFJQyxJQUFKLEdBQVdELElBQUlFLElBQWhCLEdBQXNCLENBQS9COzs7V0FHS0gsQ0FBUDs7O1dBR09JLEtBQVQsRUFBZTtXQUNOLEtBQUtQLE1BQUwsQ0FBWU8sS0FBWixDQUFQOzs7aUJBR2FBLEtBQWYsRUFBcUI7UUFDZkgsTUFBTSxLQUFLSSxRQUFMLENBQWNELEtBQWQsQ0FBVjtXQUNPSCxJQUFJQyxJQUFKLEdBQVdELElBQUlFLElBQXRCOzs7aUJBR2FDLEtBQWYsRUFBcUI7V0FDWixLQUFLQyxRQUFMLENBQWNELEtBQWQsRUFBcUJYLElBQTVCOzs7O0FBSUosU0FBU2EsUUFBVCxDQUFrQnZCLGdCQUFnQkMsT0FBT0MsR0FBUCxDQUFXLG1CQUFYLENBQWxDLEVBQW1FO1NBQzFELElBQUlILFFBQUosQ0FBYUMsYUFBYixDQUFQOzs7QUFHRixTQUFTd0IsUUFBVCxHQUFvQjtTQUNYLElBQUlyQixRQUFKLEVBQVA7OztBQUdGLFNBQVNzQixVQUFULENBQW9CcEIsTUFBcEIsRUFBNEI7U0FDbkIsSUFBSUQsVUFBSixDQUFlQyxNQUFmLENBQVA7OztBQUdGLFNBQVNxQixPQUFULENBQWlCbkIsS0FBakIsRUFBd0I7U0FDZixJQUFJRCxPQUFKLENBQVlDLEtBQVosQ0FBUDs7O0FBR0YsU0FBU29CLFFBQVQsR0FBb0I7U0FDWCxJQUFJbkIsUUFBSixFQUFQOzs7QUFHRixTQUFTRSxJQUFULENBQWNBLElBQWQsRUFBb0JDLGFBQWEsRUFBakMsRUFBcUM7U0FDNUIsSUFBSUYsSUFBSixDQUFTQyxJQUFULEVBQWVDLFVBQWYsQ0FBUDs7O0FBR0YsU0FBU2lCLEtBQVQsQ0FBZXJCLEtBQWYsRUFBc0I7U0FDYixJQUFJSyxLQUFKLENBQVVMLEtBQVYsQ0FBUDs7O0FBR0YsU0FBU3NCLGNBQVQsQ0FBd0IsR0FBR2YsTUFBM0IsRUFBa0M7U0FDekIsSUFBSUQsY0FBSixDQUFtQixHQUFHQyxNQUF0QixDQUFQO0NBR0Y7O0FDdEhBOztBQUVBLEFBV0EsU0FBU2dCLFNBQVQsQ0FBbUJ2QixLQUFuQixFQUEwQjtTQUNqQixPQUFPQSxLQUFQLEtBQWlCLFFBQXhCOzs7QUFHRixTQUFTd0IsU0FBVCxDQUFtQnhCLEtBQW5CLEVBQTBCO1NBQ2pCLE9BQU9BLEtBQVAsS0FBaUIsUUFBeEI7OztBQUdGLFNBQVN5QixVQUFULENBQW9CekIsS0FBcEIsRUFBMkI7U0FDbEIsT0FBT0EsS0FBUCxLQUFpQixTQUF4Qjs7O0FBR0YsU0FBUzBCLFNBQVQsQ0FBbUIxQixLQUFuQixFQUEwQjtTQUNqQixPQUFPQSxLQUFQLEtBQWlCLFFBQXhCOzs7QUFHRixBQUlBLFNBQVMyQixTQUFULENBQW1CM0IsS0FBbkIsRUFBMEI7U0FDakIsT0FBT0EsS0FBUCxLQUFpQixRQUF4Qjs7O0FBR0YsU0FBUzRCLFdBQVQsQ0FBcUI1QixLQUFyQixFQUE0QjtTQUNuQkEsaUJBQWlCUixRQUF4Qjs7O0FBR0YsQUFJQSxBQUlBLEFBSUEsQUFJQSxBQUlBLEFBSUEsQUFJQSxTQUFTcUMsT0FBVCxDQUFpQjdCLEtBQWpCLEVBQXdCO1NBQ2ZBLFVBQVUsSUFBakI7OztBQUdGLFNBQVM4QixRQUFULENBQWtCOUIsS0FBbEIsRUFBeUI7U0FDaEIrQixNQUFNQyxPQUFOLENBQWNoQyxLQUFkLENBQVA7OztBQUdGLFNBQVNpQyxXQUFULENBQXFCakMsS0FBckIsRUFBNEI7U0FDbkJrQyxPQUFPQyxTQUFQLENBQWlCQyxRQUFqQixDQUEwQkMsSUFBMUIsQ0FBK0JyQyxLQUEvQixLQUF5QyxtQkFBaEQ7Q0FHRjs7QUNqRkE7O0FBRUEsQUFDQSxBQUNBLEFBQ0EsQUFDQSxNQUFNc0MsWUFBWUMsWUFBWUQsU0FBOUI7O0FBRUEsU0FBU0UsYUFBVCxDQUF1QkMsT0FBdkIsRUFBZ0M7U0FDdkIsVUFBU3pDLEtBQVQsRUFBZ0I7V0FDZDBDLFNBQUEsQ0FBaUIxQyxLQUFqQixLQUEyQkEsVUFBVXlDLE9BQTVDO0dBREY7OztBQUtGLFNBQVNFLGFBQVQsQ0FBdUJGLE9BQXZCLEVBQWdDO1NBQ3ZCLFVBQVN6QyxLQUFULEVBQWdCO1dBQ2QwQyxTQUFBLENBQWlCMUMsS0FBakIsS0FBMkJBLFVBQVV5QyxPQUE1QztHQURGOzs7QUFLRixTQUFTRyxhQUFULENBQXVCSCxPQUF2QixFQUFnQztTQUN2QixVQUFTekMsS0FBVCxFQUFnQjtXQUNkMEMsU0FBQSxDQUFpQjFDLEtBQWpCLEtBQTJCQSxVQUFVeUMsT0FBNUM7R0FERjs7O0FBS0YsU0FBU0ksY0FBVCxDQUF3QkosT0FBeEIsRUFBaUM7U0FDeEIsVUFBU3pDLEtBQVQsRUFBZ0I7V0FDZDBDLFVBQUEsQ0FBa0IxQyxLQUFsQixLQUE0QkEsVUFBVXlDLE9BQTdDO0dBREY7OztBQUtGLFNBQVNLLGVBQVQsQ0FBeUJMLE9BQXpCLEVBQWtDO1NBQ3pCLFVBQVN6QyxLQUFULEVBQWdCO1dBQ2QwQyxXQUFBLENBQW1CMUMsS0FBbkIsS0FBNkJBLFVBQVV5QyxPQUE5QztHQURGOzs7QUFLRixTQUFTTSxXQUFULENBQXFCTixPQUFyQixFQUE4QjtTQUNyQixVQUFTekMsS0FBVCxFQUFnQjtXQUNkMEMsT0FBQSxDQUFlMUMsS0FBZixDQUFQO0dBREY7OztBQUtGLFNBQVNnRCxZQUFULENBQXNCUCxPQUF0QixFQUErQjtTQUN0QixVQUFTekMsS0FBVCxFQUFnQmlELElBQWhCLEVBQXNCO1FBQ3ZCLE9BQU9qRCxLQUFQLEtBQWlCLE9BQU95QyxRQUFRekMsS0FBaEMsSUFBeUNBLFVBQVV5QyxRQUFRekMsS0FBL0QsRUFBc0U7V0FDL0RrRCxJQUFMLENBQVVsRCxLQUFWO2FBQ08sSUFBUDs7O1dBR0ssS0FBUDtHQU5GOzs7QUFVRixTQUFTbUQsZUFBVCxHQUEyQjtTQUNsQixZQUFXO1dBQ1QsSUFBUDtHQURGOzs7QUFLRixTQUFTQyxlQUFULEdBQTJCO1NBQ2xCLFVBQVNwRCxLQUFULEVBQWdCaUQsSUFBaEIsRUFBc0I7U0FDdEJDLElBQUwsQ0FBVWxELEtBQVY7V0FDTyxJQUFQO0dBRkY7OztBQU1GLFNBQVNxRCxlQUFULEdBQTJCO1NBQ2xCLFVBQVNyRCxLQUFULEVBQWdCaUQsSUFBaEIsRUFBc0I7UUFDdkIsQ0FBQ1AsUUFBQSxDQUFnQjFDLEtBQWhCLENBQUQsSUFBMkJBLE1BQU1RLE1BQU4sR0FBZSxDQUE5QyxFQUFpRDthQUN4QyxLQUFQOzs7VUFHSThDLE9BQU90RCxNQUFNLENBQU4sQ0FBYjtVQUNNdUQsT0FBT3ZELE1BQU13RCxLQUFOLENBQVksQ0FBWixDQUFiOztTQUVLTixJQUFMLENBQVVJLElBQVY7U0FDS0osSUFBTCxDQUFVSyxJQUFWOztXQUVPLElBQVA7R0FYRjs7O0FBZUYsU0FBU0UsY0FBVCxDQUF3QmhCLE9BQXhCLEVBQWlDO1FBQ3pCaUIsVUFBVUMsV0FBV2xCLFFBQVF6QyxLQUFuQixDQUFoQjs7U0FFTyxVQUFTQSxLQUFULEVBQWdCaUQsSUFBaEIsRUFBc0I7UUFDdkJTLFFBQVExRCxLQUFSLEVBQWVpRCxJQUFmLENBQUosRUFBMEI7V0FDbkJDLElBQUwsQ0FBVWxELEtBQVY7YUFDTyxJQUFQOzs7V0FHSyxLQUFQO0dBTkY7OztBQVVGLFNBQVM0RCxpQkFBVCxDQUEyQm5CLE9BQTNCLEVBQW9DO1FBQzVCM0MsU0FBUzJDLFFBQVEzQyxNQUF2Qjs7U0FFTyxVQUFTRSxLQUFULEVBQWdCaUQsSUFBaEIsRUFBc0I7UUFDdkJQLFNBQUEsQ0FBaUIxQyxLQUFqQixLQUEyQkEsTUFBTWtCLFVBQU4sQ0FBaUJwQixNQUFqQixDQUEvQixFQUF5RDtXQUNsRG9ELElBQUwsQ0FBVWxELE1BQU02RCxTQUFOLENBQWdCL0QsT0FBT1UsTUFBdkIsQ0FBVjthQUNPLElBQVA7OztXQUdLLEtBQVA7R0FORjs7O0FBVUYsU0FBU3NELFdBQVQsQ0FBcUJyQixPQUFyQixFQUE4QjtTQUNyQixVQUFTekMsS0FBVCxFQUFnQmlELElBQWhCLEVBQXNCO1FBQ3ZCakQsaUJBQWlCeUMsUUFBUXRDLElBQTdCLEVBQW1DO1lBQzNCdUQsVUFBVUMsV0FBV2xCLFFBQVFyQyxVQUFuQixDQUFoQjthQUNPc0QsUUFBUTFELEtBQVIsRUFBZWlELElBQWYsS0FBd0JBLEtBQUtDLElBQUwsQ0FBVWxELEtBQVYsSUFBbUIsQ0FBbEQ7OztXQUdLLEtBQVA7R0FORjs7O0FBVUYsU0FBUytELFlBQVQsQ0FBc0J0QixPQUF0QixFQUErQjtRQUN2QmlCLFVBQVVqQixRQUFRdUIsR0FBUixDQUFZQyxLQUFLTixXQUFXTSxDQUFYLENBQWpCLENBQWhCOztTQUVPLFVBQVNqRSxLQUFULEVBQWdCaUQsSUFBaEIsRUFBc0I7UUFDdkIsQ0FBQ1AsUUFBQSxDQUFnQjFDLEtBQWhCLENBQUQsSUFBMkJBLE1BQU1RLE1BQU4sSUFBZ0JpQyxRQUFRakMsTUFBdkQsRUFBK0Q7YUFDdEQsS0FBUDs7O1dBR0tSLE1BQU1rRSxLQUFOLENBQVksVUFBU0MsQ0FBVCxFQUFZQyxDQUFaLEVBQWU7YUFDekJWLFFBQVFVLENBQVIsRUFBV3BFLE1BQU1vRSxDQUFOLENBQVgsRUFBcUJuQixJQUFyQixDQUFQO0tBREssQ0FBUDtHQUxGOzs7QUFXRixTQUFTb0IsYUFBVCxDQUF1QjVCLE9BQXZCLEVBQWdDO01BQzFCaUIsVUFBVSxFQUFkOztRQUVNWSxPQUFPcEMsT0FBT29DLElBQVAsQ0FBWTdCLE9BQVosRUFBcUI4QixNQUFyQixDQUNYckMsT0FBT3NDLHFCQUFQLENBQTZCL0IsT0FBN0IsQ0FEVyxDQUFiOztPQUlLLElBQUlnQyxHQUFULElBQWdCSCxJQUFoQixFQUFzQjtZQUNaRyxHQUFSLElBQWVkLFdBQVdsQixRQUFRZ0MsR0FBUixDQUFYLENBQWY7OztTQUdLLFVBQVN6RSxLQUFULEVBQWdCaUQsSUFBaEIsRUFBc0I7UUFDdkIsQ0FBQ1AsU0FBQSxDQUFpQjFDLEtBQWpCLENBQUQsSUFBNEJ5QyxRQUFRakMsTUFBUixHQUFpQlIsTUFBTVEsTUFBdkQsRUFBK0Q7YUFDdEQsS0FBUDs7O1NBR0csSUFBSWlFLEdBQVQsSUFBZ0JILElBQWhCLEVBQXNCO1VBQ2hCLEVBQUVHLE9BQU96RSxLQUFULEtBQW1CLENBQUMwRCxRQUFRZSxHQUFSLEVBQWF6RSxNQUFNeUUsR0FBTixDQUFiLEVBQXlCeEIsSUFBekIsQ0FBeEIsRUFBd0Q7ZUFDL0MsS0FBUDs7OztXQUlHLElBQVA7R0FYRjs7O0FBZUYsU0FBU3lCLGdCQUFULENBQTBCakMsT0FBMUIsRUFBbUM7TUFDN0JrQyxtQkFBbUIsRUFBdkI7O09BRUssSUFBSUMsa0JBQVQsSUFBK0JuQyxRQUFRbEMsTUFBdkMsRUFBK0M7UUFDekNtQyxXQUFBLENBQW1Ca0MsbUJBQW1CNUUsS0FBdEMsQ0FBSixFQUFrRDtVQUM1Q2EsT0FBT2dFLFFBQVFELG1CQUFtQmhFLElBQTNCLEVBQWlDZ0UsbUJBQW1CL0QsSUFBcEQsQ0FBWDtnQkFDVThELGdCQUFWLEVBQTRCOUQsSUFBNUI7S0FGRixNQUdPO3lCQUNjOEQsaUJBQWlCSixNQUFqQixDQUNqQixJQUFJakMsU0FBSixDQUFjc0Msa0JBQWQsRUFBa0M1RSxLQURqQixDQUFuQjs7OztNQU1BOEUsZ0JBQWdCckMsUUFBUWxDLE1BQTVCOztTQUVPLFVBQVNQLEtBQVQsRUFBZ0JpRCxJQUFoQixFQUFzQjtRQUN2QjhCLFVBQVUsSUFBZDs7UUFFSSxDQUFDckMsU0FBQSxDQUFpQjFDLEtBQWpCLENBQUQsSUFBNEIsRUFBRUEsaUJBQWlCc0MsU0FBbkIsQ0FBaEMsRUFBK0Q7YUFDdEQsS0FBUDs7O1FBR0VJLFNBQUEsQ0FBaUIxQyxLQUFqQixDQUFKLEVBQTZCO2dCQUNqQixJQUFJc0MsU0FBSixDQUFjQSxVQUFVMEMsTUFBVixDQUFpQmhGLEtBQWpCLENBQWQsQ0FBVjtLQURGLE1BRU87Z0JBQ0tBLEtBQVY7OztRQUdFaUYsaUJBQWlCLENBQXJCOztTQUVLLElBQUliLElBQUksQ0FBYixFQUFnQkEsSUFBSVUsY0FBY3RFLE1BQWxDLEVBQTBDNEQsR0FBMUMsRUFBK0M7VUFDekNRLHFCQUFxQkUsY0FBY1YsQ0FBZCxDQUF6Qjs7VUFHRTFCLFdBQUEsQ0FBbUJrQyxtQkFBbUI1RSxLQUF0QyxLQUNBNEUsbUJBQW1CekUsSUFBbkIsSUFBMkIsUUFEM0IsSUFFQXlFLG1CQUFtQi9ELElBQW5CLEtBQTRCcUUsU0FGNUIsSUFHQWQsSUFBSVUsY0FBY3RFLE1BQWQsR0FBdUIsQ0FKN0IsRUFLRTtjQUNNLElBQUkyRSxLQUFKLENBQ0osNEVBREksQ0FBTjs7O1VBS0V0RSxPQUFPLENBQVg7VUFDSXVFLG1CQUFtQixFQUF2QjtVQUNJQyw0QkFBNEIsRUFBaEM7YUFDT1IsUUFBUUQsbUJBQW1CaEUsSUFBM0IsRUFBaUNnRSxtQkFBbUIvRCxJQUFwRCxDQUFQOztVQUVJdUQsTUFBTVUsY0FBY3RFLE1BQWQsR0FBdUIsQ0FBakMsRUFBb0M7MkJBQ2Z1RSxRQUFRL0UsS0FBUixDQUFjd0QsS0FBZCxDQUFvQnlCLGNBQXBCLENBQW5CO29DQUM0Qk4saUJBQWlCbkIsS0FBakIsQ0FBdUJ5QixjQUF2QixDQUE1QjtPQUZGLE1BR087MkJBQ2NGLFFBQVEvRSxLQUFSLENBQWN3RCxLQUFkLENBQ2pCeUIsY0FEaUIsRUFFakJBLGlCQUFpQnBFLElBRkEsQ0FBbkI7b0NBSTRCOEQsaUJBQWlCbkIsS0FBakIsQ0FDMUJ5QixjQUQwQixFQUUxQkEsaUJBQWlCcEUsSUFGUyxDQUE1Qjs7O1VBTUU2QixXQUFBLENBQW1Ca0MsbUJBQW1CNUUsS0FBdEMsQ0FBSixFQUFrRDtnQkFDeEM0RSxtQkFBbUJ6RSxJQUEzQjtlQUNPLFNBQUw7Z0JBRUl5RSxtQkFBbUJVLFVBQW5CLElBQ0FWLG1CQUFtQlUsVUFBbkIsQ0FBOEJDLE9BQTlCLENBQXNDLFFBQXRDLEtBQW1ELENBQUMsQ0FGdEQsRUFHRTttQkFDS3JDLElBQUwsQ0FBVSxJQUFJc0MsU0FBSixDQUFjLENBQUNKLGlCQUFpQixDQUFqQixDQUFELENBQWQsRUFBcUMsQ0FBckMsQ0FBVjthQUpGLE1BS087bUJBQ0FsQyxJQUFMLENBQVUsSUFBSXVDLFVBQUosQ0FBZSxDQUFDTCxpQkFBaUIsQ0FBakIsQ0FBRCxDQUFmLEVBQXNDLENBQXRDLENBQVY7Ozs7ZUFJQyxPQUFMO2dCQUNNdkUsU0FBUyxFQUFiLEVBQWlCO21CQUNWcUMsSUFBTCxDQUFVd0MsYUFBYUMsSUFBYixDQUFrQlAsZ0JBQWxCLEVBQW9DLENBQXBDLENBQVY7YUFERixNQUVPLElBQUl2RSxTQUFTLEVBQWIsRUFBaUI7bUJBQ2pCcUMsSUFBTCxDQUFVMEMsYUFBYUQsSUFBYixDQUFrQlAsZ0JBQWxCLEVBQW9DLENBQXBDLENBQVY7YUFESyxNQUVBO3FCQUNFLEtBQVA7Ozs7ZUFJQyxXQUFMO2lCQUNPbEMsSUFBTCxDQUFVMkMsZ0JBQWdCVCxnQkFBaEIsQ0FBVjs7O2VBR0csUUFBTDtpQkFDT2xDLElBQUwsQ0FDRTRDLE9BQU9DLFlBQVAsQ0FBb0JDLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDLElBQUlQLFVBQUosQ0FBZUwsZ0JBQWYsQ0FBaEMsQ0FERjs7O2VBS0csTUFBTDtpQkFDT2xDLElBQUwsQ0FDRTRDLE9BQU9DLFlBQVAsQ0FBb0JDLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDLElBQUlQLFVBQUosQ0FBZUwsZ0JBQWYsQ0FBaEMsQ0FERjs7O2VBS0csT0FBTDtpQkFDT2xDLElBQUwsQ0FDRTRDLE9BQU9DLFlBQVAsQ0FBb0JDLEtBQXBCLENBQ0UsSUFERixFQUVFLElBQUlDLFdBQUosQ0FBZ0JiLGdCQUFoQixDQUZGLENBREY7OztlQVFHLE9BQUw7aUJBQ09sQyxJQUFMLENBQ0U0QyxPQUFPQyxZQUFQLENBQW9CQyxLQUFwQixDQUNFLElBREYsRUFFRSxJQUFJRSxXQUFKLENBQWdCZCxnQkFBaEIsQ0FGRixDQURGOzs7O21CQVNPLEtBQVA7O09BMUROLE1BNERPLElBQUksQ0FBQ2UsWUFBWWYsZ0JBQVosRUFBOEJDLHlCQUE5QixDQUFMLEVBQStEO2VBQzdELEtBQVA7Ozt1QkFHZUosaUJBQWlCcEUsSUFBbEM7OztXQUdLLElBQVA7R0FuSEY7OztBQXVIRixTQUFTZ0UsT0FBVCxDQUFpQmpFLElBQWpCLEVBQXVCQyxJQUF2QixFQUE2QjtTQUNwQkQsT0FBT0MsSUFBUCxHQUFjLENBQXJCOzs7QUFHRixTQUFTc0YsV0FBVCxDQUFxQkMsQ0FBckIsRUFBd0JDLENBQXhCLEVBQTJCO01BQ3JCRCxNQUFNQyxDQUFWLEVBQWEsT0FBTyxJQUFQO01BQ1RELEtBQUssSUFBTCxJQUFhQyxLQUFLLElBQXRCLEVBQTRCLE9BQU8sS0FBUDtNQUN4QkQsRUFBRTVGLE1BQUYsSUFBWTZGLEVBQUU3RixNQUFsQixFQUEwQixPQUFPLEtBQVA7O09BRXJCLElBQUk0RCxJQUFJLENBQWIsRUFBZ0JBLElBQUlnQyxFQUFFNUYsTUFBdEIsRUFBOEIsRUFBRTRELENBQWhDLEVBQW1DO1FBQzdCZ0MsRUFBRWhDLENBQUYsTUFBU2lDLEVBQUVqQyxDQUFGLENBQWIsRUFBbUIsT0FBTyxLQUFQOzs7U0FHZCxJQUFQOzs7QUFHRixTQUFTa0MsU0FBVCxDQUFtQkMsR0FBbkIsRUFBd0JDLEdBQXhCLEVBQTZCO09BQ3RCLElBQUlwQyxJQUFJLENBQWIsRUFBZ0JBLElBQUlvQyxHQUFwQixFQUF5QnBDLEdBQXpCLEVBQThCO1FBQ3hCbEIsSUFBSixDQUFTLENBQVQ7Ozs7QUFJSixTQUFTMkMsZUFBVCxDQUF5QlUsR0FBekIsRUFBOEI7TUFDeEJFLGVBQWVGLElBQUl2QyxHQUFKLENBQVEwQyxRQUFRcEUsVUFBVXFFLE9BQVYsQ0FBa0JELElBQWxCLENBQWhCLENBQW5CO1NBQ08sSUFBSXBFLFNBQUosQ0FBYyxHQUFHbUUsWUFBakIsQ0FBUDs7O0FBR0YsU0FBU0csY0FBVCxHQUEwQjtTQUNqQixZQUFXO1dBQ1QsS0FBUDtHQURGO0NBS0Y7O0FDN1RBLE1BQU1DLGFBQWEsSUFBSUMsR0FBSixFQUFuQjtBQUNBRCxXQUFXRSxHQUFYLENBQWV2SCxTQUFTMkMsU0FBeEIsRUFBbUM2RSxlQUFuQztBQUNBSCxXQUFXRSxHQUFYLENBQWVuSCxTQUFTdUMsU0FBeEIsRUFBbUM2RSxlQUFuQztBQUNBSCxXQUFXRSxHQUFYLENBQWU5RyxTQUFTa0MsU0FBeEIsRUFBbUM2RSxlQUFuQztBQUNBSCxXQUFXRSxHQUFYLENBQWVsSCxXQUFXc0MsU0FBMUIsRUFBcUM2RSxpQkFBckM7QUFDQUgsV0FBV0UsR0FBWCxDQUFlaEgsUUFBUW9DLFNBQXZCLEVBQWtDNkUsY0FBbEM7QUFDQUgsV0FBV0UsR0FBWCxDQUFlMUcsTUFBTThCLFNBQXJCLEVBQWdDNkUsWUFBaEM7QUFDQUgsV0FBV0UsR0FBWCxDQUFlN0csS0FBS2lDLFNBQXBCLEVBQStCNkUsV0FBL0I7QUFDQUgsV0FBV0UsR0FBWCxDQUFlekcsZUFBZTZCLFNBQTlCLEVBQXlDNkUsZ0JBQXpDO0FBQ0FILFdBQVdFLEdBQVgsQ0FBZUUsT0FBTzlFLFNBQXRCLEVBQWlDNkUsYUFBakM7QUFDQUgsV0FBV0UsR0FBWCxDQUFlckgsT0FBT3lDLFNBQXRCLEVBQWlDNkUsYUFBakM7QUFDQUgsV0FBV0UsR0FBWCxDQUFlaEYsTUFBTUksU0FBckIsRUFBZ0M2RSxZQUFoQztBQUNBSCxXQUFXRSxHQUFYLENBQWVqQixPQUFPM0QsU0FBdEIsRUFBaUM2RSxhQUFqQztBQUNBSCxXQUFXRSxHQUFYLENBQWVHLFFBQVEvRSxTQUF2QixFQUFrQzZFLGNBQWxDO0FBQ0FILFdBQVdFLEdBQVgsQ0FBZUksU0FBU2hGLFNBQXhCLEVBQW1DNkUsZUFBbkM7QUFDQUgsV0FBV0UsR0FBWCxDQUFlN0UsT0FBT0MsU0FBdEIsRUFBaUM2RSxhQUFqQzs7QUFFQSxBQUFPLFNBQVNyRCxVQUFULENBQW9CbEIsT0FBcEIsRUFBNkI7TUFDOUJBLFlBQVksSUFBaEIsRUFBc0I7V0FDYnVFLFdBQUEsQ0FBc0J2RSxPQUF0QixDQUFQOzs7TUFHRSxPQUFPQSxPQUFQLEtBQW1CLFdBQXZCLEVBQW9DO1dBQzNCdUUsZUFBQSxDQUEwQnZFLE9BQTFCLENBQVA7OztRQUdJdEMsVUFBT3NDLFFBQVEyRSxXQUFSLENBQW9CakYsU0FBakM7UUFDTWtGLFdBQVdSLFdBQVdTLEdBQVgsQ0FBZW5ILE9BQWYsQ0FBakI7O01BRUlrSCxRQUFKLEVBQWM7V0FDTEEsU0FBUzVFLE9BQVQsQ0FBUDs7O01BR0UsT0FBT0EsT0FBUCxLQUFtQixRQUF2QixFQUFpQztXQUN4QnVFLGFBQUEsQ0FBd0J2RSxPQUF4QixDQUFQOzs7U0FHS3VFLGNBQUEsRUFBUDs7O0FDNUNLLE1BQU1PLFVBQU4sU0FBeUJwQyxLQUF6QixDQUErQjtjQUN4QnFDLEdBQVosRUFBaUI7OztRQUdYLE9BQU9BLEdBQVAsS0FBZSxRQUFuQixFQUE2QjtXQUN0QkMsT0FBTCxHQUFlLG1CQUFtQkQsSUFBSXBGLFFBQUosRUFBbEM7S0FERixNQUVPLElBQUlMLE1BQU1DLE9BQU4sQ0FBY3dGLEdBQWQsQ0FBSixFQUF3QjtVQUN6QkUsZUFBZUYsSUFBSXhELEdBQUosQ0FBUUMsS0FBS0EsRUFBRTdCLFFBQUYsRUFBYixDQUFuQjtXQUNLcUYsT0FBTCxHQUFlLG1CQUFtQkMsWUFBbEM7S0FGSyxNQUdBO1dBQ0FELE9BQUwsR0FBZSxtQkFBbUJELEdBQWxDOzs7U0FHR0csS0FBTCxHQUFhLElBQUl4QyxLQUFKLEdBQVl3QyxLQUF6QjtTQUNLQyxJQUFMLEdBQVksS0FBS1IsV0FBTCxDQUFpQlEsSUFBN0I7Ozs7QUFJSixBQUFPLE1BQU1DLE1BQU4sQ0FBYTtjQUNOcEYsT0FBWixFQUFxQnFGLEVBQXJCLEVBQXlCQyxRQUFRLE1BQU0sSUFBdkMsRUFBNkM7U0FDdEN0RixPQUFMLEdBQWVrQixXQUFXbEIsT0FBWCxDQUFmO1NBQ0t1RixLQUFMLEdBQWF2RixRQUFRakMsTUFBckI7U0FDS3lILFNBQUwsR0FBaUJDLGtCQUFrQnpGLE9BQWxCLENBQWpCO1NBQ0txRixFQUFMLEdBQVVBLEVBQVY7U0FDS0MsS0FBTCxHQUFhQSxLQUFiOzs7O0FBSUosQUFBTyxTQUFTSSxNQUFULENBQWdCMUYsT0FBaEIsRUFBeUJxRixFQUF6QixFQUE2QkMsUUFBUSxNQUFNLElBQTNDLEVBQWlEO1NBQy9DLElBQUlGLE1BQUosQ0FBV3BGLE9BQVgsRUFBb0JxRixFQUFwQixFQUF3QkMsS0FBeEIsQ0FBUDs7O0FBR0YsQUFBTzs7QUFVUCxBQUFPLFNBQVNLLFFBQVQsQ0FBa0IsR0FBR0MsT0FBckIsRUFBOEI7UUFDN0JDLFVBQVVDLFlBQVlGLE9BQVosQ0FBaEI7O1NBRU8sVUFBUyxHQUFHcEYsSUFBWixFQUFrQjtRQUNuQixDQUFDdUYsVUFBRCxFQUFhQyxNQUFiLElBQXVCQyxxQkFBcUJ6RixJQUFyQixFQUEyQnFGLE9BQTNCLENBQTNCO1dBQ09FLFdBQVd4QyxLQUFYLENBQWlCLElBQWpCLEVBQXVCeUMsTUFBdkIsQ0FBUDtHQUZGOzs7QUFNRixBQUFPLFNBQVNFLFdBQVQsQ0FBcUIsR0FBR04sT0FBeEIsRUFBaUM7UUFDaENDLFVBQVVDLFlBQVlGLE9BQVosQ0FBaEI7O1NBRU8sV0FBVSxHQUFHcEYsSUFBYixFQUFtQjtRQUNwQixDQUFDdUYsVUFBRCxFQUFhQyxNQUFiLElBQXVCQyxxQkFBcUJ6RixJQUFyQixFQUEyQnFGLE9BQTNCLENBQTNCO1dBQ08sT0FBT0UsV0FBV3hDLEtBQVgsQ0FBaUIsSUFBakIsRUFBdUJ5QyxNQUF2QixDQUFkO0dBRkY7OztBQU1GLEFBQU8sU0FBU0csV0FBVCxDQUFxQixHQUFHM0YsSUFBeEIsRUFBOEI7U0FDNUIwRixZQUFZLEdBQUcxRixJQUFmLENBQVA7OztBQUdGLEFBQU8sU0FBUzRGLGFBQVQsQ0FBdUIsR0FBR1IsT0FBMUIsRUFBbUM7UUFDbENDLFVBQVVDLFlBQVlGLE9BQVosQ0FBaEI7O1NBRU8sZ0JBQWUsR0FBR3BGLElBQWxCLEVBQXdCO1FBQ3pCcUYsUUFBUVEsR0FBUixDQUFZN0YsS0FBS3pDLE1BQWpCLENBQUosRUFBOEI7WUFDdEJ1SSxlQUFlVCxRQUFRaEIsR0FBUixDQUFZckUsS0FBS3pDLE1BQWpCLENBQXJCOztVQUVJZ0ksYUFBYSxJQUFqQjtVQUNJQyxTQUFTLElBQWI7V0FDSyxJQUFJTyxlQUFULElBQTRCRCxZQUE1QixFQUEwQztZQUNwQ0UsU0FBUyxFQUFiO2VBQ09DLHFCQUNMakcsSUFESyxFQUVMK0YsZ0JBQWdCaEIsS0FGWCxFQUdMZ0IsZ0JBQWdCZixTQUhYLENBQVA7O1lBT0VlLGdCQUFnQnZHLE9BQWhCLENBQXdCUSxJQUF4QixFQUE4QmdHLE1BQTlCLE1BQ0MsTUFBTUQsZ0JBQWdCakIsS0FBaEIsQ0FBc0IvQixLQUF0QixDQUE0QixJQUE1QixFQUFrQ2lELE1BQWxDLENBRFAsQ0FERixFQUdFO3VCQUNhRCxnQkFBZ0JsQixFQUE3QjttQkFDU21CLE1BQVQ7Ozs7O1VBS0EsQ0FBQ1QsVUFBTCxFQUFpQjtnQkFDUFcsS0FBUixDQUFjLGVBQWQsRUFBK0JsRyxJQUEvQjtjQUNNLElBQUlzRSxVQUFKLENBQWV0RSxJQUFmLENBQU47OzthQUdLdUYsV0FBV3hDLEtBQVgsQ0FBaUIsSUFBakIsRUFBdUJ5QyxNQUF2QixDQUFQO0tBNUJGLE1BNkJPO2NBQ0dVLEtBQVIsQ0FBYyxVQUFkLEVBQTBCbEcsS0FBS3pDLE1BQS9CLEVBQXVDLDBCQUF2QyxFQUFtRXlDLElBQW5FO1lBQ00sSUFBSXNFLFVBQUosQ0FBZXRFLElBQWYsQ0FBTjs7R0FoQ0o7OztBQXFDRixTQUFTeUYsb0JBQVQsQ0FBOEJ6RixJQUE5QixFQUFvQ3FGLE9BQXBDLEVBQTZDO01BQ3ZDQSxRQUFRUSxHQUFSLENBQVk3RixLQUFLekMsTUFBakIsQ0FBSixFQUE4QjtVQUN0QnVJLGVBQWVULFFBQVFoQixHQUFSLENBQVlyRSxLQUFLekMsTUFBakIsQ0FBckI7O1FBRUlnSSxhQUFhLElBQWpCO1FBQ0lDLFNBQVMsSUFBYjtTQUNLLElBQUlPLGVBQVQsSUFBNEJELFlBQTVCLEVBQTBDO1VBQ3BDRSxTQUFTLEVBQWI7YUFDT0MscUJBQ0xqRyxJQURLLEVBRUwrRixnQkFBZ0JoQixLQUZYLEVBR0xnQixnQkFBZ0JmLFNBSFgsQ0FBUDs7VUFPRWUsZ0JBQWdCdkcsT0FBaEIsQ0FBd0JRLElBQXhCLEVBQThCZ0csTUFBOUIsS0FDQUQsZ0JBQWdCakIsS0FBaEIsQ0FBc0IvQixLQUF0QixDQUE0QixJQUE1QixFQUFrQ2lELE1BQWxDLENBRkYsRUFHRTtxQkFDYUQsZ0JBQWdCbEIsRUFBN0I7aUJBQ1NtQixNQUFUOzs7OztRQUtBLENBQUNULFVBQUwsRUFBaUI7Y0FDUFcsS0FBUixDQUFjLGVBQWQsRUFBK0JsRyxJQUEvQjtZQUNNLElBQUlzRSxVQUFKLENBQWV0RSxJQUFmLENBQU47OztXQUdLLENBQUN1RixVQUFELEVBQWFDLE1BQWIsQ0FBUDtHQTVCRixNQTZCTztZQUNHVSxLQUFSLENBQWMsVUFBZCxFQUEwQmxHLEtBQUt6QyxNQUEvQixFQUF1QywwQkFBdkMsRUFBbUV5QyxJQUFuRTtVQUNNLElBQUlzRSxVQUFKLENBQWV0RSxJQUFmLENBQU47Ozs7QUFJSixTQUFTc0YsV0FBVCxDQUFxQkYsT0FBckIsRUFBOEI7TUFDeEJyRSxNQUFNLElBQUk4QyxHQUFKLEVBQVY7O09BRUssTUFBTXFCLE1BQVgsSUFBcUJFLE9BQXJCLEVBQThCO1VBQ3RCZSxRQUFRQyxjQUFjbEIsTUFBZCxDQUFkOztTQUVLLE1BQU1ILEtBQVgsSUFBb0JvQixLQUFwQixFQUEyQjtVQUNyQkwsZUFBZSxFQUFuQjs7VUFFSS9FLElBQUk4RSxHQUFKLENBQVFkLEtBQVIsQ0FBSixFQUFvQjt1QkFDSGhFLElBQUlzRCxHQUFKLENBQVFVLEtBQVIsQ0FBZjs7O21CQUdXOUUsSUFBYixDQUFrQmlGLE1BQWxCO1VBQ0lwQixHQUFKLENBQVFpQixLQUFSLEVBQWVlLFlBQWY7Ozs7U0FJRy9FLEdBQVA7OztBQUdGLFNBQVNxRixhQUFULENBQXVCbEIsTUFBdkIsRUFBK0I7UUFDdkJtQixNQUFNbkIsT0FBT0gsS0FBUCxHQUFlRyxPQUFPRixTQUFQLENBQWlCekgsTUFBNUM7UUFDTStJLE1BQU1wQixPQUFPSCxLQUFuQjs7TUFFSW9CLFFBQVEsQ0FBQ0UsR0FBRCxDQUFaOztTQUVPRixNQUFNQSxNQUFNNUksTUFBTixHQUFlLENBQXJCLEtBQTJCK0ksR0FBbEMsRUFBdUM7VUFDL0JyRyxJQUFOLENBQVdrRyxNQUFNQSxNQUFNNUksTUFBTixHQUFlLENBQXJCLElBQTBCLENBQXJDOzs7U0FHSzRJLEtBQVA7OztBQUdGLFNBQVNsQixpQkFBVCxDQUEyQnpGLE9BQTNCLEVBQW9DO01BQzlCd0YsWUFBWSxFQUFoQjs7T0FFSyxJQUFJN0QsSUFBSSxDQUFiLEVBQWdCQSxJQUFJM0IsUUFBUWpDLE1BQTVCLEVBQW9DNEQsR0FBcEMsRUFBeUM7UUFFckMzQixRQUFRMkIsQ0FBUixhQUFzQm9GLFFBQXRCLElBQ0EvRyxRQUFRMkIsQ0FBUixFQUFXM0UsYUFBWCxJQUE0QkMsT0FBT0MsR0FBUCxDQUFXLG1CQUFYLENBRjlCLEVBR0U7Z0JBQ1V1RCxJQUFWLENBQWUsQ0FBQ2tCLENBQUQsRUFBSTNCLFFBQVEyQixDQUFSLEVBQVczRSxhQUFmLENBQWY7Ozs7U0FJR3dJLFNBQVA7OztBQUdGLFNBQVNpQixvQkFBVCxDQUE4QmpHLElBQTlCLEVBQW9DK0UsS0FBcEMsRUFBMkNDLFNBQTNDLEVBQXNEO01BQ2hEaEYsS0FBS3pDLE1BQUwsS0FBZ0J3SCxLQUFoQixJQUF5QkMsVUFBVXpILE1BQVYsS0FBcUIsQ0FBbEQsRUFBcUQ7V0FDNUN5QyxJQUFQOzs7TUFHRUEsS0FBS3pDLE1BQUwsR0FBY3lILFVBQVV6SCxNQUF4QixHQUFpQ3dILEtBQXJDLEVBQTRDO1dBQ25DL0UsSUFBUDs7O01BR0V3RywwQkFBMEJ6QixRQUFRL0UsS0FBS3pDLE1BQTNDO01BQ0lrSixvQkFBb0J6QixVQUFVekgsTUFBVixHQUFtQmlKLHVCQUEzQzs7TUFFSUUsaUJBQWlCMUIsVUFBVXpFLEtBQVYsQ0FBZ0JrRyxpQkFBaEIsQ0FBckI7O09BRUssSUFBSSxDQUFDNUksS0FBRCxFQUFRZCxLQUFSLENBQVQsSUFBMkIySixjQUEzQixFQUEyQztTQUNwQ0MsTUFBTCxDQUFZOUksS0FBWixFQUFtQixDQUFuQixFQUFzQmQsS0FBdEI7UUFDSWlELEtBQUt6QyxNQUFMLEtBQWdCd0gsS0FBcEIsRUFBMkI7Ozs7O1NBS3RCL0UsSUFBUDs7O0FBR0YsQUFBTyxTQUFTNEcsS0FBVCxDQUFlcEgsT0FBZixFQUF3QnFILElBQXhCLEVBQThCL0IsUUFBUSxNQUFNLElBQTVDLEVBQWtEO01BQ25Ea0IsU0FBUyxFQUFiO01BQ0ljLG1CQUFtQnBHLFdBQVdsQixPQUFYLENBQXZCO01BQ0lzSCxpQkFBaUJELElBQWpCLEVBQXVCYixNQUF2QixLQUFrQ2xCLE1BQU0vQixLQUFOLENBQVksSUFBWixFQUFrQmlELE1BQWxCLENBQXRDLEVBQWlFO1dBQ3hEQSxNQUFQO0dBREYsTUFFTztZQUNHRSxLQUFSLENBQWMsZUFBZCxFQUErQlcsSUFBL0I7VUFDTSxJQUFJdkMsVUFBSixDQUFldUMsSUFBZixDQUFOOzs7O0FBSUosQUFBTyxTQUFTRSxnQkFBVCxDQUNMdkgsT0FESyxFQUVMcUgsSUFGSyxFQUdML0IsUUFBUSxNQUFNLElBSFQsRUFJTHRJLGdCQUFnQixJQUpYLEVBS0w7TUFDSXdKLFNBQVMsRUFBYjtNQUNJYyxtQkFBbUJwRyxXQUFXbEIsT0FBWCxDQUF2QjtNQUNJc0gsaUJBQWlCRCxJQUFqQixFQUF1QmIsTUFBdkIsS0FBa0NsQixNQUFNL0IsS0FBTixDQUFZLElBQVosRUFBa0JpRCxNQUFsQixDQUF0QyxFQUFpRTtXQUN4REEsTUFBUDtHQURGLE1BRU87V0FDRXhKLGFBQVA7Ozs7QUM3T0osTUFBTXdLLFdBQVd2SyxRQUFqQjs7QUFFQSxBQUFPLFNBQVN3SyxtQkFBVCxDQUE2QnpILE9BQTdCLEVBQXNDMEgsU0FBdEMsRUFBaUQ7U0FDL0MsWUFBVztRQUNaQyxlQUFlLEVBQW5CO1FBQ0lDLFVBQVVGLFVBQVUzRyxLQUFWLENBQWdCLENBQWhCLEVBQW1CZixRQUFRaEMsU0FBUixFQUFuQixDQUFkO1FBQ0kyRCxJQUFJLENBQVI7O1dBRU9pRyxRQUFRNUosU0FBUixJQUFxQmdDLFFBQVFoQyxTQUFSLEVBQTVCLEVBQWlEO1lBQ3pDd0ksU0FBU2UsaUJBQWlCdkgsT0FBakIsRUFBMEI0SCxPQUExQixFQUFtQyxNQUFNLElBQXpDLEVBQStDSixRQUEvQyxDQUFmOztVQUVJaEIsVUFBVWdCLFFBQWQsRUFBd0I7Y0FDaEIsQ0FBQ2pLLEtBQUQsSUFBVWlKLE1BQWhCO3FCQUNhL0YsSUFBYixDQUFrQitGLE1BQWxCOzs7Z0JBR1FrQixVQUFVM0csS0FBVixDQUNSZixRQUFRaEMsU0FBUixLQUFzQjJELENBRGQsRUFFUjNCLFFBQVFoQyxTQUFSLE1BQXVCMkQsSUFBSSxDQUEzQixDQUZRLENBQVY7Ozs7O1dBUUtnRyxZQUFQO0dBckJGOzs7QUF5QkYsQUFBTyxTQUFTRSxjQUFULENBQXdCN0gsT0FBeEIsRUFBaUM4SCxJQUFqQyxFQUF1QztTQUNyQyxZQUFXO1FBQ1pILGVBQWUsRUFBbkI7U0FDSyxJQUFJaEcsQ0FBVCxJQUFjbUcsSUFBZCxFQUFvQjtZQUNadEIsU0FBU2UsaUJBQWlCdkgsT0FBakIsRUFBMEIyQixDQUExQixFQUE2QixNQUFNLElBQW5DLEVBQXlDNkYsUUFBekMsQ0FBZjtVQUNJaEIsVUFBVWdCLFFBQWQsRUFBd0I7Y0FDaEIsQ0FBQ2pLLEtBQUQsSUFBVWlKLE1BQWhCO3FCQUNhL0YsSUFBYixDQUFrQmxELEtBQWxCOzs7O1dBSUdvSyxZQUFQO0dBVkY7OztBQWNGLEFBQU8sU0FBU0ksa0JBQVQsQ0FBNEJDLFVBQTVCLEVBQXdDQyxVQUF4QyxFQUFvRDtRQUNuREMsa0JBQWtCQyxlQUFlRixXQUFXRyxHQUFYLElBQWYsRUFBbUNILFVBQW5DLENBQXhCOztNQUVJekIsU0FBUyxFQUFiOztPQUVLLElBQUlqSixLQUFULElBQWtCMkssZUFBbEIsRUFBbUM7UUFDN0JGLFdBQVcxQyxLQUFYLENBQWlCL0IsS0FBakIsQ0FBdUIsSUFBdkIsRUFBNkJoRyxLQUE3QixDQUFKLEVBQXlDO2FBQ2hDa0QsSUFBUCxDQUFZdUgsV0FBVzNDLEVBQVgsQ0FBYzlCLEtBQWQsQ0FBb0IsSUFBcEIsRUFBMEJoRyxLQUExQixDQUFaOzs7O1NBSUdpSixNQUFQOzs7QUFHRixTQUFTMkIsY0FBVCxDQUF3QkUsU0FBeEIsRUFBbUNKLFVBQW5DLEVBQStDO01BQ3pDQSxXQUFXbEssTUFBWCxJQUFxQixDQUF6QixFQUE0QjtXQUNuQnNLLFVBQVU5RyxHQUFWLENBQWNDLEtBQUs7VUFDcEJsQyxNQUFNQyxPQUFOLENBQWNpQyxDQUFkLENBQUosRUFBc0I7ZUFDYkEsQ0FBUDtPQURGLE1BRU87ZUFDRSxDQUFDQSxDQUFELENBQVA7O0tBSkcsQ0FBUDtHQURGLE1BUU87VUFDQ3NHLE9BQU9HLFdBQVdHLEdBQVgsRUFBYjs7UUFFSUUsV0FBVyxFQUFmO1NBQ0ssSUFBSUMsQ0FBVCxJQUFjVCxNQUFkLEVBQXNCO1dBQ2YsSUFBSW5HLENBQVQsSUFBYzBHLFNBQWQsRUFBeUI7aUJBQ2Q1SCxJQUFULENBQWMsQ0FBQzhILENBQUQsRUFBSXpHLE1BQUosQ0FBV0gsQ0FBWCxDQUFkOzs7O1dBSUd3RyxlQUFlRyxRQUFmLEVBQXlCTCxVQUF6QixDQUFQOzs7O0FBSUosQUFBTyxTQUFTTyx1QkFBVCxDQUFpQ1IsVUFBakMsRUFBNkNDLFVBQTdDLEVBQXlEO1FBQ3hEQyxrQkFBa0JDLGVBQWVGLFdBQVdHLEdBQVgsSUFBZixFQUFtQ0gsVUFBbkMsQ0FBeEI7O01BRUl6QixTQUFTLEVBQWI7O09BRUssSUFBSWpKLEtBQVQsSUFBa0IySyxlQUFsQixFQUFtQztRQUM3QkYsV0FBVzFDLEtBQVgsQ0FBaUIvQixLQUFqQixDQUF1QixJQUF2QixFQUE2QmhHLEtBQTdCLENBQUosRUFBeUM7YUFDaENrRCxJQUFQLENBQVl1SCxXQUFXM0MsRUFBWCxDQUFjOUIsS0FBZCxDQUFvQixJQUFwQixFQUEwQmhHLEtBQTFCLENBQVo7Ozs7V0FJS2lKLE9BQU9qRixHQUFQLENBQVdDLEtBQUsxQixZQUFZRCxTQUFaLENBQXNCcUUsT0FBdEIsQ0FBOEIxQyxDQUE5QixDQUFoQixDQUFUO1NBQ08sSUFBSTFCLFlBQVlELFNBQWhCLENBQTBCLEdBQUcyRyxNQUE3QixDQUFQOzs7QUNsRUYsWUFBZTtVQUFBO09BQUE7WUFBQTtVQUFBO1VBQUE7WUFBQTtTQUFBO1VBQUE7TUFBQTtPQUFBO1FBQUE7UUFBQTtnQkFBQTtrQkFBQTthQUFBO29CQUFBO2dCQUFBO3FCQUFBO3lCQUFBO2FBQUE7O0NBQWY7OyJ9
