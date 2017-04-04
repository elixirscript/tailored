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

  for (let key of Object.keys(pattern).concat(Object.getOwnPropertySymbols(pattern))) {
    matches[key] = buildMatch(pattern[key]);
  }

  return function (value, args) {
    if (!is_object(value) || pattern.length > value.length) {
      return false;
    }

    for (let key of Object.keys(pattern).concat(Object.getOwnPropertySymbols(pattern))) {
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
        throw new Error("a binary field without size is only allowed at the end of a binary pattern");
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
            if (bitstringMatchPart.attributes && bitstringMatchPart.attributes.indexOf("signed") != -1) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdHlwZXMnO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbn1cblxuZnVuY3Rpb24gaXNfYm9vbGVhbih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbic7XG59XG5cbmZ1bmN0aW9uIGlzX3N5bWJvbCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3ltYm9sJztcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19vYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCc7XG59XG5cbmZ1bmN0aW9uIGlzX3ZhcmlhYmxlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFZhcmlhYmxlO1xufVxuXG5mdW5jdGlvbiBpc193aWxkY2FyZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBXaWxkY2FyZDtcbn1cblxuZnVuY3Rpb24gaXNfaGVhZFRhaWwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSGVhZFRhaWw7XG59XG5cbmZ1bmN0aW9uIGlzX2NhcHR1cmUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQ2FwdHVyZTtcbn1cblxuZnVuY3Rpb24gaXNfdHlwZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBUeXBlO1xufVxuXG5mdW5jdGlvbiBpc19zdGFydHNXaXRoKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFN0YXJ0c1dpdGg7XG59XG5cbmZ1bmN0aW9uIGlzX2JvdW5kKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJvdW5kO1xufVxuXG5mdW5jdGlvbiBpc19iaXRzdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nTWF0Y2g7XG59XG5cbmZ1bmN0aW9uIGlzX251bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2Z1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbmV4cG9ydCB7XG4gIGlzX251bWJlcixcbiAgaXNfc3RyaW5nLFxuICBpc19ib29sZWFuLFxuICBpc19zeW1ib2wsXG4gIGlzX251bGwsXG4gIGlzX3VuZGVmaW5lZCxcbiAgaXNfZnVuY3Rpb24sXG4gIGlzX3ZhcmlhYmxlLFxuICBpc193aWxkY2FyZCxcbiAgaXNfaGVhZFRhaWwsXG4gIGlzX2NhcHR1cmUsXG4gIGlzX3R5cGUsXG4gIGlzX3N0YXJ0c1dpdGgsXG4gIGlzX2JvdW5kLFxuICBpc19vYmplY3QsXG4gIGlzX2FycmF5LFxuICBpc19iaXRzdHJpbmcsXG59O1xuIiwiLyogQGZsb3cgKi9cblxuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gXCIuL2NoZWNrc1wiO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IGJ1aWxkTWF0Y2ggfSBmcm9tIFwiLi9tYXRjaFwiO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gXCJlcmxhbmctdHlwZXNcIjtcbmNvbnN0IEJpdFN0cmluZyA9IEVybGFuZ1R5cGVzLkJpdFN0cmluZztcblxuZnVuY3Rpb24gcmVzb2x2ZVN5bWJvbChwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTnVtYmVyKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfbnVtYmVyKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvb2xlYW4ocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfZnVuY3Rpb24odmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTnVsbChwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bGwodmFsdWUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQm91bmQocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncyl7XG4gICAgaWYodHlwZW9mIHZhbHVlID09PSB0eXBlb2YgcGF0dGVybi52YWx1ZSAmJiB2YWx1ZSA9PT0gcGF0dGVybi52YWx1ZSl7XG4gICAgICBhcmdzLnB1c2godmFsdWUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlV2lsZGNhcmQoKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVmFyaWFibGUoKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKXtcbiAgICBhcmdzLnB1c2godmFsdWUpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSGVhZFRhaWwoKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCA8IDIpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IGhlYWQgPSB2YWx1ZVswXTtcbiAgICBjb25zdCB0YWlsID0gdmFsdWUuc2xpY2UoMSk7XG5cbiAgICBhcmdzLnB1c2goaGVhZCk7XG4gICAgYXJncy5wdXNoKHRhaWwpO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVDYXB0dXJlKHBhdHRlcm4pIHtcbiAgY29uc3QgbWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi52YWx1ZSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYobWF0Y2hlcyh2YWx1ZSwgYXJncykpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0YXJ0c1dpdGgocGF0dGVybikge1xuICBjb25zdCBwcmVmaXggPSBwYXR0ZXJuLnByZWZpeDtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZihDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZS5zdGFydHNXaXRoKHByZWZpeCkpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVUeXBlKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuLnR5cGUpe1xuICAgICAgY29uc3QgbWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi5vYmpQYXR0ZXJuKTtcbiAgICAgIHJldHVybiBtYXRjaGVzKHZhbHVlLCBhcmdzKSAmJiBhcmdzLnB1c2godmFsdWUpID4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVBcnJheShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBwYXR0ZXJuLm1hcCh4ID0+IGJ1aWxkTWF0Y2goeCkpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCAhPSBwYXR0ZXJuLmxlbmd0aCl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlLmV2ZXJ5KGZ1bmN0aW9uKHYsIGkpIHtcbiAgICAgIHJldHVybiBtYXRjaGVzW2ldKHZhbHVlW2ldLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU9iamVjdChwYXR0ZXJuKSB7XG4gIGxldCBtYXRjaGVzID0ge307XG5cbiAgZm9yKGxldCBrZXkgb2YgT2JqZWN0LmtleXMocGF0dGVybikuY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocGF0dGVybikpKXtcbiAgICBtYXRjaGVzW2tleV0gPSBidWlsZE1hdGNoKHBhdHRlcm5ba2V5XSk7XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX29iamVjdCh2YWx1ZSkgfHwgcGF0dGVybi5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvcihsZXQga2V5IG9mIE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pKSl7XG4gICAgICBpZighKGtleSBpbiB2YWx1ZSkgfHwgIW1hdGNoZXNba2V5XSh2YWx1ZVtrZXldLCBhcmdzKSApe1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCaXRTdHJpbmcocGF0dGVybikge1xuICBsZXQgcGF0dGVybkJpdFN0cmluZyA9IFtdO1xuXG4gIGZvcihsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0IG9mIHBhdHRlcm4udmFsdWVzKXtcbiAgICBpZihDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSl7XG4gICAgICBsZXQgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcbiAgICAgIGZpbGxBcnJheShwYXR0ZXJuQml0U3RyaW5nLCBzaXplKTtcbiAgICB9ZWxzZXtcbiAgICAgIHBhdHRlcm5CaXRTdHJpbmcgPSBwYXR0ZXJuQml0U3RyaW5nLmNvbmNhdChuZXcgQml0U3RyaW5nKGJpdHN0cmluZ01hdGNoUGFydCkudmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIGxldCBwYXR0ZXJuVmFsdWVzID0gcGF0dGVybi52YWx1ZXM7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgbGV0IGJzVmFsdWUgPSBudWxsO1xuXG4gICAgaWYoIUNoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmcpICl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkpe1xuICAgICAgYnNWYWx1ZSA9IG5ldyBCaXRTdHJpbmcoQml0U3RyaW5nLmJpbmFyeSh2YWx1ZSkpO1xuICAgIH1lbHNle1xuICAgICAgYnNWYWx1ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGxldCBiZWdpbm5pbmdJbmRleCA9IDA7XG5cbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgcGF0dGVyblZhbHVlcy5sZW5ndGg7IGkrKyl7XG4gICAgICBsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0ID0gcGF0dGVyblZhbHVlc1tpXTtcblxuICAgICAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkgJiZcbiAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC50eXBlID09ICdiaW5hcnknICYmXG4gICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgICBpIDwgcGF0dGVyblZhbHVlcy5sZW5ndGggLSAxKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYSBiaW5hcnkgZmllbGQgd2l0aG91dCBzaXplIGlzIG9ubHkgYWxsb3dlZCBhdCB0aGUgZW5kIG9mIGEgYmluYXJ5IHBhdHRlcm5cIik7XG4gICAgICB9XG5cbiAgICAgIGxldCBzaXplID0gMDtcbiAgICAgIGxldCBic1ZhbHVlQXJyYXlQYXJ0ID0gW107XG4gICAgICBsZXQgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IFtdO1xuICAgICAgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcblxuICAgICAgaWYoaSA9PT0gcGF0dGVyblZhbHVlcy5sZW5ndGggLSAxKXtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShiZWdpbm5pbmdJbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBic1ZhbHVlQXJyYXlQYXJ0ID0gYnNWYWx1ZS52YWx1ZS5zbGljZShiZWdpbm5pbmdJbmRleCwgYmVnaW5uaW5nSW5kZXggKyBzaXplKTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgsIGJlZ2lubmluZ0luZGV4ICsgc2l6ZSk7XG4gICAgICB9XG5cbiAgICAgIGlmKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpKXtcbiAgICAgICAgc3dpdGNoKGJpdHN0cmluZ01hdGNoUGFydC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ2ludGVnZXInOlxuICAgICAgICAgIGlmKGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzICYmIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzLmluZGV4T2YoXCJzaWduZWRcIikgIT0gLTEpe1xuICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBJbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgVWludDhBcnJheShbYnNWYWx1ZUFycmF5UGFydFswXV0pWzBdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnZmxvYXQnOlxuICAgICAgICAgIGlmKHNpemUgPT09IDY0KXtcbiAgICAgICAgICAgIGFyZ3MucHVzaChGbG9hdDY0QXJyYXkuZnJvbShic1ZhbHVlQXJyYXlQYXJ0KVswXSk7XG4gICAgICAgICAgfSBlbHNlIGlmKHNpemUgPT09IDMyKXtcbiAgICAgICAgICAgIGFyZ3MucHVzaChGbG9hdDMyQXJyYXkuZnJvbShic1ZhbHVlQXJyYXlQYXJ0KVswXSk7XG4gICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2JpdHN0cmluZyc6XG4gICAgICAgICAgYXJncy5wdXNoKGNyZWF0ZUJpdFN0cmluZyhic1ZhbHVlQXJyYXlQYXJ0KSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgICAgIGFyZ3MucHVzaChTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KGJzVmFsdWVBcnJheVBhcnQpKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAndXRmMTYnOlxuICAgICAgICAgIGFyZ3MucHVzaChTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50MTZBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3V0ZjMyJzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDMyQXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfWVsc2UgaWYoIWFycmF5c0VxdWFsKGJzVmFsdWVBcnJheVBhcnQsIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgYmVnaW5uaW5nSW5kZXggPSBiZWdpbm5pbmdJbmRleCArIHNpemU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbn1cblxuZnVuY3Rpb24gZ2V0U2l6ZSh1bml0LCBzaXplKXtcbiAgcmV0dXJuICh1bml0ICogc2l6ZSkgLyA4O1xufVxuXG5mdW5jdGlvbiBhcnJheXNFcXVhbChhLCBiKSB7XG4gIGlmIChhID09PSBiKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgaWYgKGEubGVuZ3RoICE9IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBmaWxsQXJyYXkoYXJyLCBudW0pe1xuICBmb3IobGV0IGkgPSAwOyBpIDwgbnVtOyBpKyspe1xuICAgIGFyci5wdXNoKDApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJpdFN0cmluZyhhcnIpe1xuICBsZXQgaW50ZWdlclBhcnRzID0gYXJyLm1hcCgoZWxlbSkgPT4gQml0U3RyaW5nLmludGVnZXIoZWxlbSkpO1xuICByZXR1cm4gbmV3IEJpdFN0cmluZyguLi5pbnRlZ2VyUGFydHMpO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTm9NYXRjaCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZXhwb3J0IHtcbiAgcmVzb2x2ZUJvdW5kLFxuICByZXNvbHZlV2lsZGNhcmQsXG4gIHJlc29sdmVWYXJpYWJsZSxcbiAgcmVzb2x2ZUhlYWRUYWlsLFxuICByZXNvbHZlQ2FwdHVyZSxcbiAgcmVzb2x2ZVN0YXJ0c1dpdGgsXG4gIHJlc29sdmVUeXBlLFxuICByZXNvbHZlQXJyYXksXG4gIHJlc29sdmVPYmplY3QsXG4gIHJlc29sdmVOb01hdGNoLFxuICByZXNvbHZlU3ltYm9sLFxuICByZXNvbHZlU3RyaW5nLFxuICByZXNvbHZlTnVtYmVyLFxuICByZXNvbHZlQm9vbGVhbixcbiAgcmVzb2x2ZUZ1bmN0aW9uLFxuICByZXNvbHZlTnVsbCxcbiAgcmVzb2x2ZUJpdFN0cmluZ1xufTtcbiIsImltcG9ydCAqIGFzIFJlc29sdmVycyBmcm9tICcuL3Jlc29sdmVycyc7XG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBwYXR0ZXJuTWFwID0gbmV3IE1hcCgpO1xucGF0dGVybk1hcC5zZXQoVmFyaWFibGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVZhcmlhYmxlKTtcbnBhdHRlcm5NYXAuc2V0KFdpbGRjYXJkLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZCk7XG5wYXR0ZXJuTWFwLnNldChIZWFkVGFpbC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwpO1xucGF0dGVybk1hcC5zZXQoU3RhcnRzV2l0aC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aCk7XG5wYXR0ZXJuTWFwLnNldChDYXB0dXJlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKTtcbnBhdHRlcm5NYXAuc2V0KEJvdW5kLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCb3VuZCk7XG5wYXR0ZXJuTWFwLnNldChUeXBlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVUeXBlKTtcbnBhdHRlcm5NYXAuc2V0KEJpdFN0cmluZ01hdGNoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoTnVtYmVyLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVOdW1iZXIpO1xucGF0dGVybk1hcC5zZXQoU3ltYm9sLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTeW1ib2wpO1xucGF0dGVybk1hcC5zZXQoQXJyYXkucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUFycmF5KTtcbnBhdHRlcm5NYXAuc2V0KFN0cmluZy5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RyaW5nKTtcbnBhdHRlcm5NYXAuc2V0KEJvb2xlYW4ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvb2xlYW4pO1xucGF0dGVybk1hcC5zZXQoT2JqZWN0LnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QpO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG4gIGlmIChwYXR0ZXJuID09PSBudWxsKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlTnVsbChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGNvbnN0IHR5cGUgPSBwYXR0ZXJuLmNvbnN0cnVjdG9yLnByb3RvdHlwZTtcbiAgY29uc3QgcmVzb2x2ZXIgPSBwYXR0ZXJuTWFwLmdldCh0eXBlKTtcblxuICBpZiAocmVzb2x2ZXIpIHtcbiAgICByZXR1cm4gcmVzb2x2ZXIocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCJpbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSAnLi9tYXRjaCc7XG5pbXBvcnQgKiBhcyBUeXBlcyBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgRlVOQyA9IFN5bWJvbCgpO1xuXG5leHBvcnQgY2xhc3MgTWF0Y2hFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoYXJnKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnc3ltYm9sJykge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZy50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICBsZXQgbWFwcGVkVmFsdWVzID0gYXJnLm1hcCh4ID0+IHgudG9TdHJpbmcoKSk7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hnZW4oLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIHlpZWxkKiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEdlbiguLi5hcmdzKSB7XG4gIHJldHVybiBkZWZtYXRjaGdlbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoQXN5bmMoLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgICBhcmdzLFxuICAgICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpICYmXG4gICAgICAgICAgKGF3YWl0IHByb2Nlc3NlZENsYXVzZS5ndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKVxuICAgICAgICApIHtcbiAgICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICAgIHBhcmFtcyA9IHJlc3VsdDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIWZ1bmNUb0NhbGwpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignQXJpdHkgb2YnLCBhcmdzLmxlbmd0aCwgJ25vdCBmb3VuZC4gTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKSB7XG4gIGlmIChhcml0aWVzLmhhcyhhcmdzLmxlbmd0aCkpIHtcbiAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgbGV0IHBhcmFtcyA9IG51bGw7XG4gICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgYXJncyA9IGZpbGxJbk9wdGlvbmFsVmFsdWVzKFxuICAgICAgICBhcmdzLFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHMsXG4gICAgICApO1xuXG4gICAgICBpZiAoXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5wYXR0ZXJuKGFyZ3MsIHJlc3VsdCkgJiZcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdClcbiAgICAgICkge1xuICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFtmdW5jVG9DYWxsLCBwYXJhbXNdO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBcml0eU1hcChjbGF1c2VzKSB7XG4gIGxldCBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgZm9yIChjb25zdCBjbGF1c2Ugb2YgY2xhdXNlcykge1xuICAgIGNvbnN0IHJhbmdlID0gZ2V0QXJpdHlSYW5nZShjbGF1c2UpO1xuXG4gICAgZm9yIChjb25zdCBhcml0eSBvZiByYW5nZSkge1xuICAgICAgbGV0IGFyaXR5Q2xhdXNlcyA9IFtdO1xuXG4gICAgICBpZiAobWFwLmhhcyhhcml0eSkpIHtcbiAgICAgICAgYXJpdHlDbGF1c2VzID0gbWFwLmdldChhcml0eSk7XG4gICAgICB9XG5cbiAgICAgIGFyaXR5Q2xhdXNlcy5wdXNoKGNsYXVzZSk7XG4gICAgICBtYXAuc2V0KGFyaXR5LCBhcml0eUNsYXVzZXMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXA7XG59XG5cbmZ1bmN0aW9uIGdldEFyaXR5UmFuZ2UoY2xhdXNlKSB7XG4gIGNvbnN0IG1pbiA9IGNsYXVzZS5hcml0eSAtIGNsYXVzZS5vcHRpb25hbHMubGVuZ3RoO1xuICBjb25zdCBtYXggPSBjbGF1c2UuYXJpdHk7XG5cbiAgbGV0IHJhbmdlID0gW21pbl07XG5cbiAgd2hpbGUgKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICE9IG1heCkge1xuICAgIHJhbmdlLnB1c2gocmFuZ2VbcmFuZ2UubGVuZ3RoIC0gMV0gKyAxKTtcbiAgfVxuXG4gIHJldHVybiByYW5nZTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybikge1xuICBsZXQgb3B0aW9uYWxzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFxuICAgICAgcGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmXG4gICAgICBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWUgIT0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuICAgICkge1xuICAgICAgb3B0aW9uYWxzLnB1c2goW2ksIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvcHRpb25hbHM7XG59XG5cbmZ1bmN0aW9uIGZpbGxJbk9wdGlvbmFsVmFsdWVzKGFyZ3MsIGFyaXR5LCBvcHRpb25hbHMpIHtcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSB8fCBvcHRpb25hbHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBpZiAoYXJncy5sZW5ndGggKyBvcHRpb25hbHMubGVuZ3RoIDwgYXJpdHkpIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGxldCBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCA9IGFyaXR5IC0gYXJncy5sZW5ndGg7XG4gIGxldCBvcHRpb25hbHNUb1JlbW92ZSA9IG9wdGlvbmFscy5sZW5ndGggLSBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbDtcblxuICBsZXQgb3B0aW9uYWxzVG9Vc2UgPSBvcHRpb25hbHMuc2xpY2Uob3B0aW9uYWxzVG9SZW1vdmUpO1xuXG4gIGZvciAobGV0IFtpbmRleCwgdmFsdWVdIG9mIG9wdGlvbmFsc1RvVXNlKSB7XG4gICAgYXJncy5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKTtcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5KSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJncztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm4sIGV4cHIsIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgZXhwcik7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoZXhwcik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHQoXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gKCkgPT4gdHJ1ZSxcbiAgZGVmYXVsdF92YWx1ZSA9IG51bGwsXG4pIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGlmIChwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCkgJiYgZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cbiIsImltcG9ydCB7IG1hdGNoX29yX2RlZmF1bHQgfSBmcm9tIFwiLi9kZWZtYXRjaFwiO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gXCJlcmxhbmctdHlwZXNcIjtcblxuY29uc3QgTk9fTUFUQ0ggPSBTeW1ib2woKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19nZW5lcmF0b3IocGF0dGVybiwgYml0c3RyaW5nKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgbGV0IGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoMCwgcGF0dGVybi5ieXRlX3NpemUoKSk7XG4gICAgbGV0IGkgPSAxO1xuXG4gICAgd2hpbGUgKGJzU2xpY2UuYnl0ZV9zaXplID09IHBhdHRlcm4uYnl0ZV9zaXplKCkpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgYnNTbGljZSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuXG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiBpLFxuICAgICAgICBwYXR0ZXJuLmJ5dGVfc2l6ZSgpICogKGkgKyAxKVxuICAgICAgKTtcblxuICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2dlbmVyYXRvcihwYXR0ZXJuLCBsaXN0KSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgZm9yIChsZXQgaSBvZiBsaXN0KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaF9vcl9kZWZhdWx0KHBhdHRlcm4sIGksICgpID0+IHRydWUsIE5PX01BVENIKTtcbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3IsIGdlbmVyYXRvcnMpIHtcbiAgaWYgKGdlbmVyYXRvcnMubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yLm1hcCh4ID0+IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHgpKSB7XG4gICAgICAgIHJldHVybiB4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFt4XTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBsaXN0ID0gZ2VuZXJhdG9ycy5wb3AoKTtcblxuICAgIGxldCBuZXh0X2dlbiA9IFtdO1xuICAgIGZvciAobGV0IGogb2YgbGlzdCgpKSB7XG4gICAgICBmb3IgKGxldCBpIG9mIGdlbmVyYXRvcikge1xuICAgICAgICBuZXh0X2dlbi5wdXNoKFtqXS5jb25jYXQoaSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBydW5fZ2VuZXJhdG9ycyhuZXh0X2dlbiwgZ2VuZXJhdG9ycyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9ycy5wb3AoKSgpLCBnZW5lcmF0b3JzKTtcblxuICBsZXQgcmVzdWx0ID0gW107XG5cbiAgZm9yIChsZXQgdmFsdWUgb2YgZ2VuZXJhdGVkVmFsdWVzKSB7XG4gICAgaWYgKGV4cHJlc3Npb24uZ3VhcmQuYXBwbHkodGhpcywgdmFsdWUpKSB7XG4gICAgICByZXN1bHQucHVzaChleHByZXNzaW9uLmZuLmFwcGx5KHRoaXMsIHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgcmVzdWx0ID0gcmVzdWx0Lm1hcCh4ID0+IEVybGFuZ1R5cGVzLkJpdFN0cmluZy5pbnRlZ2VyKHgpKTtcbiAgcmV0dXJuIG5ldyBFcmxhbmdUeXBlcy5CaXRTdHJpbmcoLi4ucmVzdWx0KTtcbn1cbiIsImltcG9ydCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICBkZWZtYXRjaEdlbixcbiAgZGVmbWF0Y2hBc3luYyxcbn0gZnJvbSAnLi90YWlsb3JlZC9kZWZtYXRjaCc7XG5pbXBvcnQge1xuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdGFpbG9yZWQvdHlwZXMnO1xuXG5pbXBvcnQge1xuICBsaXN0X2dlbmVyYXRvcixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbn0gZnJvbSAnLi90YWlsb3JlZC9jb21wcmVoZW5zaW9ucyc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIGJpdFN0cmluZ01hdGNoLFxuICBtYXRjaF9vcl9kZWZhdWx0LFxuICBkZWZtYXRjaGdlbixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBsaXN0X2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb24sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jLFxufTtcbiJdLCJuYW1lcyI6WyJWYXJpYWJsZSIsImRlZmF1bHRfdmFsdWUiLCJTeW1ib2wiLCJmb3IiLCJXaWxkY2FyZCIsIlN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJDYXB0dXJlIiwidmFsdWUiLCJIZWFkVGFpbCIsIlR5cGUiLCJ0eXBlIiwib2JqUGF0dGVybiIsIkJvdW5kIiwiQml0U3RyaW5nTWF0Y2giLCJ2YWx1ZXMiLCJsZW5ndGgiLCJieXRlX3NpemUiLCJzIiwidmFsIiwidW5pdCIsInNpemUiLCJpbmRleCIsImdldFZhbHVlIiwidmFyaWFibGUiLCJ3aWxkY2FyZCIsInN0YXJ0c1dpdGgiLCJjYXB0dXJlIiwiaGVhZFRhaWwiLCJib3VuZCIsImJpdFN0cmluZ01hdGNoIiwiaXNfbnVtYmVyIiwiaXNfc3RyaW5nIiwiaXNfYm9vbGVhbiIsImlzX3N5bWJvbCIsImlzX29iamVjdCIsImlzX3ZhcmlhYmxlIiwiaXNfbnVsbCIsImlzX2FycmF5IiwiQXJyYXkiLCJpc0FycmF5IiwiQml0U3RyaW5nIiwiRXJsYW5nVHlwZXMiLCJyZXNvbHZlU3ltYm9sIiwicGF0dGVybiIsIkNoZWNrcyIsInJlc29sdmVTdHJpbmciLCJyZXNvbHZlTnVtYmVyIiwicmVzb2x2ZUJvb2xlYW4iLCJyZXNvbHZlTnVsbCIsInJlc29sdmVCb3VuZCIsImFyZ3MiLCJwdXNoIiwicmVzb2x2ZVdpbGRjYXJkIiwicmVzb2x2ZVZhcmlhYmxlIiwicmVzb2x2ZUhlYWRUYWlsIiwiaGVhZCIsInRhaWwiLCJzbGljZSIsInJlc29sdmVDYXB0dXJlIiwibWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJyZXNvbHZlU3RhcnRzV2l0aCIsInN1YnN0cmluZyIsInJlc29sdmVUeXBlIiwicmVzb2x2ZUFycmF5IiwibWFwIiwieCIsImV2ZXJ5IiwidiIsImkiLCJyZXNvbHZlT2JqZWN0Iiwia2V5IiwiT2JqZWN0Iiwia2V5cyIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiZnJvbSIsIkZsb2F0MzJBcnJheSIsImNyZWF0ZUJpdFN0cmluZyIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImFwcGx5IiwiVWludDE2QXJyYXkiLCJVaW50MzJBcnJheSIsImFycmF5c0VxdWFsIiwiYSIsImIiLCJmaWxsQXJyYXkiLCJhcnIiLCJudW0iLCJpbnRlZ2VyUGFydHMiLCJlbGVtIiwiaW50ZWdlciIsInJlc29sdmVOb01hdGNoIiwicGF0dGVybk1hcCIsIk1hcCIsInNldCIsInByb3RvdHlwZSIsIlJlc29sdmVycyIsIk51bWJlciIsIkJvb2xlYW4iLCJjb25zdHJ1Y3RvciIsInJlc29sdmVyIiwiZ2V0IiwiTWF0Y2hFcnJvciIsImFyZyIsIm1lc3NhZ2UiLCJ0b1N0cmluZyIsIm1hcHBlZFZhbHVlcyIsInN0YWNrIiwibmFtZSIsIkNsYXVzZSIsImZuIiwiZ3VhcmQiLCJhcml0eSIsIm9wdGlvbmFscyIsImdldE9wdGlvbmFsVmFsdWVzIiwiY2xhdXNlIiwiZGVmbWF0Y2giLCJjbGF1c2VzIiwiYXJpdGllcyIsImdldEFyaXR5TWFwIiwiZnVuY1RvQ2FsbCIsInBhcmFtcyIsImZpbmRNYXRjaGluZ0Z1bmN0aW9uIiwiZGVmbWF0Y2hnZW4iLCJkZWZtYXRjaEdlbiIsImRlZm1hdGNoQXN5bmMiLCJoYXMiLCJhcml0eUNsYXVzZXMiLCJwcm9jZXNzZWRDbGF1c2UiLCJyZXN1bHQiLCJmaWxsSW5PcHRpb25hbFZhbHVlcyIsImVycm9yIiwicmFuZ2UiLCJnZXRBcml0eVJhbmdlIiwibWluIiwibWF4IiwiVHlwZXMiLCJudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCIsIm9wdGlvbmFsc1RvUmVtb3ZlIiwib3B0aW9uYWxzVG9Vc2UiLCJzcGxpY2UiLCJtYXRjaCIsImV4cHIiLCJwcm9jZXNzZWRQYXR0ZXJuIiwibWF0Y2hfb3JfZGVmYXVsdCIsIk5PX01BVENIIiwiYml0c3RyaW5nX2dlbmVyYXRvciIsImJpdHN0cmluZyIsInJldHVyblJlc3VsdCIsImJzU2xpY2UiLCJsaXN0X2dlbmVyYXRvciIsImxpc3QiLCJsaXN0X2NvbXByZWhlbnNpb24iLCJleHByZXNzaW9uIiwiZ2VuZXJhdG9ycyIsImdlbmVyYXRlZFZhbHVlcyIsInJ1bl9nZW5lcmF0b3JzIiwicG9wIiwiZ2VuZXJhdG9yIiwibmV4dF9nZW4iLCJqIiwiYml0c3RyaW5nX2NvbXByZWhlbnNpb24iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOztBQUVBLE1BQU1BLFFBQU4sQ0FBZTs7Y0FFREMsZ0JBQWdCQyxPQUFPQyxH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
