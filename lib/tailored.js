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

function is_null(value) {
  return value === null;
}

function is_undefined(value) {
  return typeof value === 'undefined';
}

function is_variable(value) {
  return value instanceof Variable;
}

function is_wildcard(value) {
  return value instanceof Wildcard;
}

function is_headTail(value) {
  return value instanceof HeadTail;
}

function is_capture(value) {
  return value instanceof Capture;
}

function is_type(value) {
  return value instanceof Type;
}

function is_startsWith(value) {
  return value instanceof StartsWith;
}

function is_bound(value) {
  return value instanceof Bound;
}

function is_object(value) {
  return typeof value === 'object';
}

function is_array(value) {
  return Array.isArray(value);
}

function is_bitstring(value) {
  return value instanceof BitStringMatch;
}

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

function buildMatch(pattern) {

  if (is_variable(pattern)) {
    return resolveVariable(pattern);
  }

  if (is_wildcard(pattern)) {
    return resolveWildcard(pattern);
  }

  if (is_undefined(pattern)) {
    return resolveWildcard(pattern);
  }

  if (is_headTail(pattern)) {
    return resolveHeadTail(pattern);
  }

  if (is_startsWith(pattern)) {
    return resolveStartsWith(pattern);
  }

  if (is_capture(pattern)) {
    return resolveCapture(pattern);
  }

  if (is_bound(pattern)) {
    return resolveBound(pattern);
  }

  if (is_type(pattern)) {
    return resolveType(pattern);
  }

  if (is_array(pattern)) {
    return resolveArray(pattern);
  }

  if (is_number(pattern)) {
    return resolveNumber(pattern);
  }

  if (is_string(pattern)) {
    return resolveString(pattern);
  }

  if (is_boolean(pattern)) {
    return resolveBoolean(pattern);
  }

  if (is_symbol(pattern)) {
    return resolveSymbol(pattern);
  }

  if (is_null(pattern)) {
    return resolveNull(pattern);
  }

  if (is_bitstring(pattern)) {
    return resolveBitString(pattern);
  }

  if (is_object(pattern)) {
    return resolveObject(pattern);
  }

  return resolveNoMatch();
}

class MatchError extends Error {
  constructor(arg) {
    super();

    if (typeof arg === "symbol") {
      this.message = "No match for: " + arg.toString();
    } else if (Array.isArray(arg)) {
      let mappedValues = arg.map(x => x.toString());
      this.message = "No match for: " + mappedValues;
    } else {
      this.message = "No match for: " + arg;
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

function trampoline(fn) {
  return function () {
    let res = fn.apply(this, arguments);
    while (res instanceof Function) {
      res = res();
    }
    return res;
  };
}

function defmatch(...clauses) {
  return function (...args) {
    let funcToCall = null;
    let params = null;
    for (let processedClause of clauses) {
      let result = [];
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        funcToCall = processedClause.fn;
        params = result;
        break;
      }
    }

    if (!funcToCall) {
      console.error("No match for:", args);
      throw new MatchError(args);
    }

    return funcToCall.apply(this, params);
  };
}

function defmatchgen(...clauses) {
  return function* (...args) {
    for (let processedClause of clauses) {
      let result = [];
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        return yield* processedClause.fn.apply(this, result);
      }
    }

    console.error("No match for:", args);
    throw new MatchError(args);
  };
}

function getOptionalValues(pattern) {
  let optionals = [];

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] instanceof Variable && pattern[i].default_value != Symbol.for("tailored.no_value")) {
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
    console.error("No match for:", expr);
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
  trampoline
};

module.exports = index;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgeyBWYXJpYWJsZSwgV2lsZGNhcmQsIEhlYWRUYWlsLCBDYXB0dXJlLCBUeXBlLCBTdGFydHNXaXRoLCBCb3VuZCwgQml0U3RyaW5nTWF0Y2ggfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSl7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc19ib29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn1cblxuZnVuY3Rpb24gaXNfc3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnO1xufVxuXG5mdW5jdGlvbiBpc19udWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19mdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5mdW5jdGlvbiBpc192YXJpYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZTtcbn1cblxuZnVuY3Rpb24gaXNfd2lsZGNhcmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2lsZGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2hlYWRUYWlsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEhlYWRUYWlsO1xufVxuXG5mdW5jdGlvbiBpc19jYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhcHR1cmU7XG59XG5cbmZ1bmN0aW9uIGlzX3R5cGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVHlwZTtcbn1cblxuZnVuY3Rpb24gaXNfc3RhcnRzV2l0aCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBTdGFydHNXaXRoO1xufVxuXG5mdW5jdGlvbiBpc19ib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCb3VuZDtcbn1cblxuZnVuY3Rpb24gaXNfb2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2JpdHN0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmdNYXRjaDtcbn1cblxuZXhwb3J0IHtcbiAgaXNfbnVtYmVyLFxuICBpc19zdHJpbmcsXG4gIGlzX2Jvb2xlYW4sXG4gIGlzX3N5bWJvbCxcbiAgaXNfbnVsbCxcbiAgaXNfdW5kZWZpbmVkLFxuICBpc19mdW5jdGlvbixcbiAgaXNfdmFyaWFibGUsXG4gIGlzX3dpbGRjYXJkLFxuICBpc19oZWFkVGFpbCxcbiAgaXNfY2FwdHVyZSxcbiAgaXNfdHlwZSxcbiAgaXNfc3RhcnRzV2l0aCxcbiAgaXNfYm91bmQsXG4gIGlzX29iamVjdCxcbiAgaXNfYXJyYXksXG4gIGlzX2JpdHN0cmluZ1xufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCAqIGFzIENoZWNrcyBmcm9tIFwiLi9jaGVja3NcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tIFwiZXJsYW5nLXR5cGVzXCI7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19zeW1ib2wodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RyaW5nKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfYm9vbGVhbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVGdW5jdGlvbihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Z1bmN0aW9uKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bGwocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3Mpe1xuICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCl7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZhcmlhYmxlKCl7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncyl7XG4gICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUhlYWRUYWlsKCkge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPCAyKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgYXJncy5wdXNoKGhlYWQpO1xuICAgIGFyZ3MucHVzaCh0YWlsKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKG1hdGNoZXModmFsdWUsIGFyZ3MpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdGFydHNXaXRoKHBhdHRlcm4pIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVHlwZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybi50eXBlKXtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncykgJiYgYXJncy5wdXNoKHZhbHVlKSA+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggIT0gcGF0dGVybi5sZW5ndGgpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZS5ldmVyeShmdW5jdGlvbih2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPYmplY3QocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IHt9O1xuXG4gIGZvcihsZXQga2V5IG9mIE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pKSl7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoIUNoZWNrcy5pc19vYmplY3QodmFsdWUpIHx8IHBhdHRlcm4ubGVuZ3RoID4gdmFsdWUubGVuZ3RoKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IobGV0IGtleSBvZiBPYmplY3Qua2V5cyhwYXR0ZXJuKS5jb25jYXQoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhwYXR0ZXJuKSkpe1xuICAgICAgaWYoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IobGV0IGJpdHN0cmluZ01hdGNoUGFydCBvZiBwYXR0ZXJuLnZhbHVlcyl7XG4gICAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpe1xuICAgICAgbGV0IHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG4gICAgICBmaWxsQXJyYXkocGF0dGVybkJpdFN0cmluZywgc2l6ZSk7XG4gICAgfWVsc2V7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQobmV3IEJpdFN0cmluZyhiaXRzdHJpbmdNYXRjaFBhcnQpLnZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBsZXQgcGF0dGVyblZhbHVlcyA9IHBhdHRlcm4udmFsdWVzO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGxldCBic1ZhbHVlID0gbnVsbDtcblxuICAgIGlmKCFDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiAhKHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nKSApe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKXtcbiAgICAgIGJzVmFsdWUgPSBuZXcgQml0U3RyaW5nKEJpdFN0cmluZy5iaW5hcnkodmFsdWUpKTtcbiAgICB9ZWxzZXtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoOyBpKyspe1xuICAgICAgbGV0IGJpdHN0cmluZ01hdGNoUGFydCA9IHBhdHRlcm5WYWx1ZXNbaV07XG5cbiAgICAgIGlmKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpICYmXG4gICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImEgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuXCIpO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmKGkgPT09IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgsIGJlZ2lubmluZ0luZGV4ICsgc2l6ZSk7XG4gICAgICAgIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBwYXR0ZXJuQml0U3RyaW5nLnNsaWNlKGJlZ2lubmluZ0luZGV4LCBiZWdpbm5pbmdJbmRleCArIHNpemUpO1xuICAgICAgfVxuXG4gICAgICBpZihDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSl7XG4gICAgICAgIHN3aXRjaChiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSkge1xuICAgICAgICBjYXNlICdpbnRlZ2VyJzpcbiAgICAgICAgICBpZihiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcyAmJiBiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcy5pbmRleE9mKFwic2lnbmVkXCIpICE9IC0xKXtcbiAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgSW50OEFycmF5KFtic1ZhbHVlQXJyYXlQYXJ0WzBdXSlbMF0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICBpZihzaXplID09PSA2NCl7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH0gZWxzZSBpZihzaXplID09PSAzMil7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgIGFyZ3MucHVzaChjcmVhdGVCaXRTdHJpbmcoYnNWYWx1ZUFycmF5UGFydCkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1lbHNlIGlmKCFhcnJheXNFcXVhbChic1ZhbHVlQXJyYXlQYXJ0LCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGJlZ2lubmluZ0luZGV4ID0gYmVnaW5uaW5nSW5kZXggKyBzaXplO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG59XG5cbmZ1bmN0aW9uIGdldFNpemUodW5pdCwgc2l6ZSl7XG4gIHJldHVybiAodW5pdCAqIHNpemUpIC8gODtcbn1cblxuZnVuY3Rpb24gYXJyYXlzRXF1YWwoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmIChhLmxlbmd0aCAhPSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbEFycmF5KGFyciwgbnVtKXtcbiAgZm9yKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKXtcbiAgICBhcnIucHVzaCgwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVCaXRTdHJpbmcoYXJyKXtcbiAgbGV0IGludGVnZXJQYXJ0cyA9IGFyci5tYXAoKGVsZW0pID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmdcbn07XG4iLCIvKiBAZmxvdyAqL1xuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gXCIuL2NoZWNrc1wiO1xuaW1wb3J0ICogYXMgUmVzb2x2ZXJzIGZyb20gXCIuL3Jlc29sdmVyc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG5cbiAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc193aWxkY2FyZChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfdW5kZWZpbmVkKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19oZWFkVGFpbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfc3RhcnRzV2l0aChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19jYXB0dXJlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2JvdW5kKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb3VuZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc190eXBlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVUeXBlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2FycmF5KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVBcnJheShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19udW1iZXIocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bWJlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19zdHJpbmcocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZVN0cmluZyhwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19ib29sZWFuKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX3N5bWJvbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3ltYm9sKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX251bGwocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfYml0c3RyaW5nKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfb2JqZWN0KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCJpbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5cbmNvbnN0IEZVTkMgPSBTeW1ib2woKTtcblxuZXhwb3J0IGNsYXNzIE1hdGNoRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGFyZykge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gXCJzeW1ib2xcIikge1xuICAgICAgdGhpcy5tZXNzYWdlID0gXCJObyBtYXRjaCBmb3I6IFwiICsgYXJnLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAgIGxldCBtYXBwZWRWYWx1ZXMgPSBhcmcubWFwKHggPT4geC50b1N0cmluZygpKTtcbiAgICAgIHRoaXMubWVzc2FnZSA9IFwiTm8gbWF0Y2ggZm9yOiBcIiArIG1hcHBlZFZhbHVlcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5tZXNzYWdlID0gXCJObyBtYXRjaCBmb3I6IFwiICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICBmb3IgKGxldCBwcm9jZXNzZWRDbGF1c2Ugb2YgY2xhdXNlcykge1xuICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgYXJncyA9IGZpbGxJbk9wdGlvbmFsVmFsdWVzKFxuICAgICAgICBhcmdzLFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHNcbiAgICAgICk7XG5cbiAgICAgIGlmIChcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KSAmJlxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KVxuICAgICAgKSB7XG4gICAgICAgIGZ1bmNUb0NhbGwgPSBwcm9jZXNzZWRDbGF1c2UuZm47XG4gICAgICAgIHBhcmFtcyA9IHJlc3VsdDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiTm8gbWF0Y2ggZm9yOlwiLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaGdlbiguLi5jbGF1c2VzKSB7XG4gIHJldHVybiBmdW5jdGlvbiooLi4uYXJncykge1xuICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBjbGF1c2VzKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgIGFyZ3MsXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFsc1xuICAgICAgKTtcblxuICAgICAgaWYgKFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpICYmXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5ndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIHlpZWxkKiBwcm9jZXNzZWRDbGF1c2UuZm4uYXBwbHkodGhpcywgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zb2xlLmVycm9yKFwiTm8gbWF0Y2ggZm9yOlwiLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybikge1xuICBsZXQgb3B0aW9uYWxzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFxuICAgICAgcGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmXG4gICAgICBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWUgIT0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpXG4gICAgKSB7XG4gICAgICBvcHRpb25hbHMucHVzaChbaSwgcGF0dGVybltpXS5kZWZhdWx0X3ZhbHVlXSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9wdGlvbmFscztcbn1cblxuZnVuY3Rpb24gZmlsbEluT3B0aW9uYWxWYWx1ZXMoYXJncywgYXJpdHksIG9wdGlvbmFscykge1xuICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5IHx8IG9wdGlvbmFscy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGlmIChhcmdzLmxlbmd0aCArIG9wdGlvbmFscy5sZW5ndGggPCBhcml0eSkge1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgbGV0IG51bWJlck9mT3B0aW9uYWxzVG9GaWxsID0gYXJpdHkgLSBhcmdzLmxlbmd0aDtcbiAgbGV0IG9wdGlvbmFsc1RvUmVtb3ZlID0gb3B0aW9uYWxzLmxlbmd0aCAtIG51bWJlck9mT3B0aW9uYWxzVG9GaWxsO1xuXG4gIGxldCBvcHRpb25hbHNUb1VzZSA9IG9wdGlvbmFscy5zbGljZShvcHRpb25hbHNUb1JlbW92ZSk7XG5cbiAgZm9yIChsZXQgW2luZGV4LCB2YWx1ZV0gb2Ygb3B0aW9uYWxzVG9Vc2UpIHtcbiAgICBhcmdzLnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gYXJpdHkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhcmdzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2gocGF0dGVybiwgZXhwciwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBpZiAocHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpICYmIGd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdCkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJObyBtYXRjaCBmb3I6XCIsIGV4cHIpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGV4cHIpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaF9vcl9kZWZhdWx0KFxuICBwYXR0ZXJuLFxuICBleHByLFxuICBndWFyZCA9ICgpID0+IHRydWUsXG4gIGRlZmF1bHRfdmFsdWUgPSBudWxsXG4pIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGlmIChwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCkgJiYgZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cbiIsImltcG9ydCB7IG1hdGNoX29yX2RlZmF1bHQgfSBmcm9tIFwiLi9kZWZtYXRjaFwiO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gXCJlcmxhbmctdHlwZXNcIjtcblxuY29uc3QgTk9fTUFUQ0ggPSBTeW1ib2woKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19nZW5lcmF0b3IocGF0dGVybiwgYml0c3RyaW5nKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgbGV0IGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoMCwgcGF0dGVybi5ieXRlX3NpemUoKSk7XG4gICAgbGV0IGkgPSAxO1xuXG4gICAgd2hpbGUgKGJzU2xpY2UuYnl0ZV9zaXplID09IHBhdHRlcm4uYnl0ZV9zaXplKCkpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgYnNTbGljZSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuXG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiBpLFxuICAgICAgICBwYXR0ZXJuLmJ5dGVfc2l6ZSgpICogKGkgKyAxKVxuICAgICAgKTtcblxuICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2dlbmVyYXRvcihwYXR0ZXJuLCBsaXN0KSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgZm9yIChsZXQgaSBvZiBsaXN0KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaF9vcl9kZWZhdWx0KHBhdHRlcm4sIGksICgpID0+IHRydWUsIE5PX01BVENIKTtcbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3IsIGdlbmVyYXRvcnMpIHtcbiAgaWYgKGdlbmVyYXRvcnMubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yLm1hcCh4ID0+IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHgpKSB7XG4gICAgICAgIHJldHVybiB4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFt4XTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBsaXN0ID0gZ2VuZXJhdG9ycy5wb3AoKTtcblxuICAgIGxldCBuZXh0X2dlbiA9IFtdO1xuICAgIGZvciAobGV0IGogb2YgbGlzdCgpKSB7XG4gICAgICBmb3IgKGxldCBpIG9mIGdlbmVyYXRvcikge1xuICAgICAgICBuZXh0X2dlbi5wdXNoKFtqXS5jb25jYXQoaSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBydW5fZ2VuZXJhdG9ycyhuZXh0X2dlbiwgZ2VuZXJhdG9ycyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9ycy5wb3AoKSgpLCBnZW5lcmF0b3JzKTtcblxuICBsZXQgcmVzdWx0ID0gW107XG5cbiAgZm9yIChsZXQgdmFsdWUgb2YgZ2VuZXJhdGVkVmFsdWVzKSB7XG4gICAgaWYgKGV4cHJlc3Npb24uZ3VhcmQuYXBwbHkodGhpcywgdmFsdWUpKSB7XG4gICAgICByZXN1bHQucHVzaChleHByZXNzaW9uLmZuLmFwcGx5KHRoaXMsIHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgcmVzdWx0ID0gcmVzdWx0Lm1hcCh4ID0+IEVybGFuZ1R5cGVzLkJpdFN0cmluZy5pbnRlZ2VyKHgpKTtcbiAgcmV0dXJuIG5ldyBFcmxhbmdUeXBlcy5CaXRTdHJpbmcoLi4ucmVzdWx0KTtcbn1cbiIsImltcG9ydCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICB0cmFtcG9saW5lXG59IGZyb20gXCIuL3RhaWxvcmVkL2RlZm1hdGNoXCI7XG5pbXBvcnQge1xuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn0gZnJvbSBcIi4vdGFpbG9yZWQvdHlwZXNcIjtcblxuaW1wb3J0IHtcbiAgbGlzdF9nZW5lcmF0b3IsXG4gIGxpc3RfY29tcHJlaGVuc2lvbixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb25cbn0gZnJvbSBcIi4vdGFpbG9yZWQvY29tcHJlaGVuc2lvbnNcIjtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBkZWZtYXRjaCxcbiAgbWF0Y2gsXG4gIE1hdGNoRXJyb3IsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgYml0U3RyaW5nTWF0Y2gsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbiAgdHJhbXBvbGluZVxufTtcbiJdLCJuYW1lcyI6WyJWYXJpYWJsZSIsImRlZmF1bHRfdmFsdWUiLCJTeW1ib2wiLCJmb3IiLCJXaWxkY2FyZCIsIlN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJDYXB0dXJlIiwidmFsdWUiLCJIZWFkVGFpbCIsIlR5cGUiLCJ0eXBlIiwib2JqUGF0dGVybiIsIkJvdW5kIiwiQml0U3RyaW5nTWF0Y2giLCJ2YWx1ZXMiLCJsZW5ndGgiLCJieXRlX3NpemUiLCJzIiwidmFsIiwidW5pdCIsInNpemUiLCJpbmRleCIsImdldFZhbHVlIiwidmFyaWFibGUiLCJ3aWxkY2FyZCIsInN0YXJ0c1dpdGgiLCJjYXB0dXJlIiwiaGVhZFRhaWwiLCJib3VuZCIsImJpdFN0cmluZ01hdGNoIiwiaXNfbnVtYmVyIiwiaXNfc3RyaW5nIiwiaXNfYm9vbGVhbiIsImlzX3N5bWJvbCIsImlzX251bGwiLCJpc191bmRlZmluZWQiLCJpc192YXJpYWJsZSIsImlzX3dpbGRjYXJkIiwiaXNfaGVhZFRhaWwiLCJpc19jYXB0dXJlIiwiaXNfdHlwZSIsImlzX3N0YXJ0c1dpdGgiLCJpc19ib3VuZCIsImlzX29iamVjdCIsImlzX2FycmF5IiwiQXJyYXkiLCJpc0FycmF5IiwiaXNfYml0c3RyaW5nIiwiQml0U3RyaW5nIiwiRXJsYW5nVHlwZXMiLCJyZXNvbHZlU3ltYm9sIiwicGF0dGVybiIsIkNoZWNrcyIsInJlc29sdmVTdHJpbmciLCJyZXNvbHZlTnVtYmVyIiwicmVzb2x2ZUJvb2xlYW4iLCJyZXNvbHZlTnVsbCIsInJlc29sdmVCb3VuZCIsImFyZ3MiLCJwdXNoIiwicmVzb2x2ZVdpbGRjYXJkIiwicmVzb2x2ZVZhcmlhYmxlIiwicmVzb2x2ZUhlYWRUYWlsIiwiaGVhZCIsInRhaWwiLCJzbGljZSIsInJlc29sdmVDYXB0dXJlIiwibWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJyZXNvbHZlU3RhcnRzV2l0aCIsInN1YnN0cmluZyIsInJlc29sdmVUeXBlIiwicmVzb2x2ZUFycmF5IiwibWFwIiwieCIsImV2ZXJ5IiwidiIsImkiLCJyZXNvbHZlT2JqZWN0Iiwia2V5IiwiT2JqZWN0Iiwia2V5cyIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiZnJvbSIsIkZsb2F0MzJBcnJheSIsImNyZWF0ZUJpdFN0cmluZyIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImFwcGx5IiwiVWludDE2QXJyYXkiLCJVaW50MzJBcnJheSIsImFycmF5c0VxdWFsIiwiYSIsImIiLCJmaWxsQXJyYXkiLCJhcnIiLCJudW0iLCJpbnRlZ2VyUGFydHMiLCJlbGVtIiwiaW50ZWdlciIsInJlc29sdmVOb01hdGNoIiwiUmVzb2x2ZXJzIiwiTWF0Y2hFcnJvciIsImFyZyIsIm1lc3NhZ2UiLCJ0b1N0cmluZyIsIm1hcHBlZFZhbHVlcyIsInN0YWNrIiwibmFtZSIsImNvbnN0cnVjdG9yIiwiQ2xhdXNlIiwiZm4iLCJndWFyZCIsImFyaXR5Iiwib3B0aW9uYWxzIiwiZ2V0T3B0aW9uYWxWYWx1ZXMiLCJjbGF1c2UiLCJ0cmFtcG9saW5lIiwicmVzIiwiYXJndW1lbnRzIiwiRnVuY3Rpb24iLCJkZWZtYXRjaCIsImNsYXVzZXMiLCJmdW5jVG9DYWxsIiwicGFyYW1zIiwicHJvY2Vzc2VkQ2xhdXNlIiwicmVzdWx0IiwiZmlsbEluT3B0aW9uYWxWYWx1ZXMiLCJlcnJvciIsImRlZm1hdGNoZ2VuIiwiVHlwZXMiLCJudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCIsIm9wdGlvbmFsc1RvUmVtb3ZlIiwib3B0aW9uYWxzVG9Vc2UiLCJzcGxpY2UiLCJtYXRjaCIsImV4cHIiLCJwcm9jZXNzZWRQYXR0ZXJuIiwibWF0Y2hfb3JfZGVmYXVsdCIsIk5PX01BVENIIiwiYml0c3RyaW5nX2dlbmVyYXRvciIsImJpdHN0cmluZyIsInJldHVyblJlc3VsdCIsImJzU2xpY2UiLCJsaXN0X2dlbmVyYXRvciIsImxpc3QiLCJsaXN0X2NvbXByZWhlbnNpb24iLCJleHByZXNzaW9uIiwiZ2VuZXJhdG9ycyIsImdlbmVyYXRlZFZhbHVlcyIsInJ1bl9nZW5lcmF0b3JzIiwicG9wIiwiZ2VuZXJhdG9yIiwibmV4dF9nZW4iLCJqIiwiYml0c3RyaW5nX2NvbXByZWhlbnNpb24iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOztBQUVBLE1BQU1BLFFBQU4sQ0FBZTs7Y0FFREMsZ0JBQWdCQyxPQUFPQyxHQUFQLENBQVcsbUJBQVgsQ0FBNUIsRUFBNkQ7U0FDdERGLGFBQUwsR0FBcUJBLGFBQXJCOzs7O0FBSUosTUFBTUcsUUFBTixDQUFlO2dCQUNDOzs7QUFJ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