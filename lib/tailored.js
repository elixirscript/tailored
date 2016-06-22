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
  return function (...args) {
    for (let processedClause of clauses) {
      let result = [];
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        return processedClause.fn.apply(this, result);
      }
    }

    console.error('No match for:', args);
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

var index = {
  defmatch, match, MatchError,
  variable, wildcard, startsWith,
  capture, headTail, type, bound,
  Clause, clause, bitStringMatch,
  match_or_default
};

module.exports = index;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgeyBWYXJpYWJsZSwgV2lsZGNhcmQsIEhlYWRUYWlsLCBDYXB0dXJlLCBUeXBlLCBTdGFydHNXaXRoLCBCb3VuZCwgQml0U3RyaW5nTWF0Y2ggfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSl7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc19ib29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn1cblxuZnVuY3Rpb24gaXNfc3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnO1xufVxuXG5mdW5jdGlvbiBpc19udWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19mdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5mdW5jdGlvbiBpc192YXJpYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZTtcbn1cblxuZnVuY3Rpb24gaXNfd2lsZGNhcmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2lsZGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2hlYWRUYWlsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEhlYWRUYWlsO1xufVxuXG5mdW5jdGlvbiBpc19jYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhcHR1cmU7XG59XG5cbmZ1bmN0aW9uIGlzX3R5cGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVHlwZTtcbn1cblxuZnVuY3Rpb24gaXNfc3RhcnRzV2l0aCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBTdGFydHNXaXRoO1xufVxuXG5mdW5jdGlvbiBpc19ib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCb3VuZDtcbn1cblxuZnVuY3Rpb24gaXNfb2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2JpdHN0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmdNYXRjaDtcbn1cblxuZXhwb3J0IHtcbiAgaXNfbnVtYmVyLFxuICBpc19zdHJpbmcsXG4gIGlzX2Jvb2xlYW4sXG4gIGlzX3N5bWJvbCxcbiAgaXNfbnVsbCxcbiAgaXNfdW5kZWZpbmVkLFxuICBpc19mdW5jdGlvbixcbiAgaXNfdmFyaWFibGUsXG4gIGlzX3dpbGRjYXJkLFxuICBpc19oZWFkVGFpbCxcbiAgaXNfY2FwdHVyZSxcbiAgaXNfdHlwZSxcbiAgaXNfc3RhcnRzV2l0aCxcbiAgaXNfYm91bmQsXG4gIGlzX29iamVjdCxcbiAgaXNfYXJyYXksXG4gIGlzX2JpdHN0cmluZ1xufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCAqIGFzIENoZWNrcyBmcm9tIFwiLi9jaGVja3NcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tIFwiZXJsYW5nLXR5cGVzXCI7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19zeW1ib2wodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RyaW5nKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfYm9vbGVhbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVGdW5jdGlvbihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Z1bmN0aW9uKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bGwocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3Mpe1xuICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCl7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZhcmlhYmxlKCl7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncyl7XG4gICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUhlYWRUYWlsKCkge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPCAyKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgYXJncy5wdXNoKGhlYWQpO1xuICAgIGFyZ3MucHVzaCh0YWlsKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKG1hdGNoZXModmFsdWUsIGFyZ3MpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdGFydHNXaXRoKHBhdHRlcm4pIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVHlwZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybi50eXBlKXtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncykgJiYgYXJncy5wdXNoKHZhbHVlKSA+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggIT0gcGF0dGVybi5sZW5ndGgpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZS5ldmVyeShmdW5jdGlvbih2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPYmplY3QocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IHt9O1xuXG4gIGZvcihsZXQga2V5IG9mIE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pKSl7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoIUNoZWNrcy5pc19vYmplY3QodmFsdWUpIHx8IHBhdHRlcm4ubGVuZ3RoID4gdmFsdWUubGVuZ3RoKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IobGV0IGtleSBvZiBPYmplY3Qua2V5cyhwYXR0ZXJuKS5jb25jYXQoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhwYXR0ZXJuKSkpe1xuICAgICAgaWYoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IobGV0IGJpdHN0cmluZ01hdGNoUGFydCBvZiBwYXR0ZXJuLnZhbHVlcyl7XG4gICAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpe1xuICAgICAgbGV0IHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG4gICAgICBmaWxsQXJyYXkocGF0dGVybkJpdFN0cmluZywgc2l6ZSk7XG4gICAgfWVsc2V7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQobmV3IEJpdFN0cmluZyhiaXRzdHJpbmdNYXRjaFBhcnQpLnZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBsZXQgcGF0dGVyblZhbHVlcyA9IHBhdHRlcm4udmFsdWVzO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGxldCBic1ZhbHVlID0gbnVsbDtcblxuICAgIGlmKCFDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiAhKHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nKSApe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKXtcbiAgICAgIGJzVmFsdWUgPSBuZXcgQml0U3RyaW5nKEJpdFN0cmluZy5iaW5hcnkodmFsdWUpKTtcbiAgICB9ZWxzZXtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoOyBpKyspe1xuICAgICAgbGV0IGJpdHN0cmluZ01hdGNoUGFydCA9IHBhdHRlcm5WYWx1ZXNbaV07XG5cbiAgICAgIGlmKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpICYmXG4gICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImEgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuXCIpO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmKGkgPT09IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgsIGJlZ2lubmluZ0luZGV4ICsgc2l6ZSk7XG4gICAgICAgIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBwYXR0ZXJuQml0U3RyaW5nLnNsaWNlKGJlZ2lubmluZ0luZGV4LCBiZWdpbm5pbmdJbmRleCArIHNpemUpO1xuICAgICAgfVxuXG4gICAgICBpZihDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSl7XG4gICAgICAgIHN3aXRjaChiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSkge1xuICAgICAgICBjYXNlICdpbnRlZ2VyJzpcbiAgICAgICAgICBpZihiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcyAmJiBiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcy5pbmRleE9mKFwic2lnbmVkXCIpICE9IC0xKXtcbiAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgSW50OEFycmF5KFtic1ZhbHVlQXJyYXlQYXJ0WzBdXSlbMF0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICBpZihzaXplID09PSA2NCl7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH0gZWxzZSBpZihzaXplID09PSAzMil7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgIGFyZ3MucHVzaChjcmVhdGVCaXRTdHJpbmcoYnNWYWx1ZUFycmF5UGFydCkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1lbHNlIGlmKCFhcnJheXNFcXVhbChic1ZhbHVlQXJyYXlQYXJ0LCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGJlZ2lubmluZ0luZGV4ID0gYmVnaW5uaW5nSW5kZXggKyBzaXplO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG59XG5cbmZ1bmN0aW9uIGdldFNpemUodW5pdCwgc2l6ZSl7XG4gIHJldHVybiAodW5pdCAqIHNpemUpIC8gODtcbn1cblxuZnVuY3Rpb24gYXJyYXlzRXF1YWwoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmIChhLmxlbmd0aCAhPSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbEFycmF5KGFyciwgbnVtKXtcbiAgZm9yKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKXtcbiAgICBhcnIucHVzaCgwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVCaXRTdHJpbmcoYXJyKXtcbiAgbGV0IGludGVnZXJQYXJ0cyA9IGFyci5tYXAoKGVsZW0pID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmdcbn07XG4iLCIvKiBAZmxvdyAqL1xuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gXCIuL2NoZWNrc1wiO1xuaW1wb3J0ICogYXMgUmVzb2x2ZXJzIGZyb20gXCIuL3Jlc29sdmVyc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG5cbiAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc193aWxkY2FyZChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfdW5kZWZpbmVkKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19oZWFkVGFpbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfc3RhcnRzV2l0aChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19jYXB0dXJlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2JvdW5kKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb3VuZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc190eXBlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVUeXBlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2FycmF5KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVBcnJheShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19udW1iZXIocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bWJlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19zdHJpbmcocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZVN0cmluZyhwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19ib29sZWFuKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX3N5bWJvbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3ltYm9sKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX251bGwocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfYml0c3RyaW5nKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfb2JqZWN0KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBjbGFzcyBNYXRjaEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihhcmcpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYodHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcpe1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZy50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZihBcnJheS5pc0FycmF5KGFyZykpe1xuICAgICAgbGV0IG1hcHBlZFZhbHVlcyA9IGFyZy5tYXAoKHgpID0+IHgudG9TdHJpbmcoKSk7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH1lbHNle1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZztcbiAgICB9XG5cbiAgICB0aGlzLnN0YWNrID0gKG5ldyBFcnJvcigpKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQ2xhdXNlIHtcbiAgY29uc3RydWN0b3IocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSl7XG4gICAgdGhpcy5wYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgICB0aGlzLmFyaXR5ID0gcGF0dGVybi5sZW5ndGg7XG4gICAgdGhpcy5vcHRpb25hbHMgPSBnZXRPcHRpb25hbFZhbHVlcyhwYXR0ZXJuKTtcbiAgICB0aGlzLmZuID0gZm47XG4gICAgdGhpcy5ndWFyZCA9IGd1YXJkO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGF1c2UocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICByZXR1cm4gbmV3IENsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBjbGF1c2VzKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoYXJncywgcHJvY2Vzc2VkQ2xhdXNlLmFyaXR5LCBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzKTtcblxuICAgICAgaWYgKHByb2Nlc3NlZENsYXVzZS5wYXR0ZXJuKGFyZ3MsIHJlc3VsdCkgJiYgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdCkpIHtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3NlZENsYXVzZS5mbi5hcHBseSh0aGlzLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybil7XG4gIGxldCBvcHRpb25hbHMgPSBbXTtcblxuICBmb3IobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGg7IGkrKyl7XG4gICAgaWYocGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZSAhPSBTeW1ib2wuZm9yKFwidGFpbG9yZWQubm9fdmFsdWVcIikpe1xuICAgICAgb3B0aW9uYWxzLnB1c2goW2ksIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvcHRpb25hbHM7XG59XG5cbmZ1bmN0aW9uIGZpbGxJbk9wdGlvbmFsVmFsdWVzKGFyZ3MsIGFyaXR5LCBvcHRpb25hbHMpe1xuICBpZihhcmdzLmxlbmd0aCA9PT0gYXJpdHkgfHwgb3B0aW9uYWxzLmxlbmd0aCA9PT0gMCl7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBpZihhcmdzLmxlbmd0aCArIG9wdGlvbmFscy5sZW5ndGggPCBhcml0eSl7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBsZXQgbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwgPSBhcml0eSAtIGFyZ3MubGVuZ3RoO1xuICBsZXQgb3B0aW9uYWxzVG9SZW1vdmUgPSBvcHRpb25hbHMubGVuZ3RoIC0gbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGw7XG5cbiAgbGV0IG9wdGlvbmFsc1RvVXNlID0gb3B0aW9uYWxzLnNsaWNlKG9wdGlvbmFsc1RvUmVtb3ZlKTtcblxuICBmb3IobGV0IFtpbmRleCwgdmFsdWVdIG9mIG9wdGlvbmFsc1RvVXNlKXtcbiAgICBhcmdzLnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuICAgIGlmKGFyZ3MubGVuZ3RoID09PSBhcml0eSl7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJncztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm4sIGV4cHIsIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKXtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9ZWxzZXtcbiAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgZXhwcik7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoZXhwcik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgZXhwciwgZ3VhcmQgPSAoKSA9PiB0cnVlLCBkZWZhdWx0X3ZhbHVlID0gbnVsbCkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKXtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9ZWxzZXtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgZGVmbWF0Y2gsIG1hdGNoLCBNYXRjaEVycm9yLCBDbGF1c2UsIGNsYXVzZSwgbWF0Y2hfb3JfZGVmYXVsdCB9IGZyb20gXCIuL3RhaWxvcmVkL2RlZm1hdGNoXCI7XG5pbXBvcnQgeyB2YXJpYWJsZSwgd2lsZGNhcmQsIHN0YXJ0c1dpdGgsIGNhcHR1cmUsIGhlYWRUYWlsLCB0eXBlLCBib3VuZCwgYml0U3RyaW5nTWF0Y2ggfSBmcm9tIFwiLi90YWlsb3JlZC90eXBlc1wiO1xuXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZGVmbWF0Y2gsIG1hdGNoLCBNYXRjaEVycm9yLFxuICB2YXJpYWJsZSwgd2lsZGNhcmQsIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsIGhlYWRUYWlsLCB0eXBlLCBib3VuZCxcbiAgQ2xhdXNlLCBjbGF1c2UsIGJpdFN0cmluZ01hdGNoLFxuICBtYXRjaF9vcl9kZWZhdWx0XG59O1xuIl0sIm5hbWVzIjpbIkNoZWNrcy5pc19zeW1ib2wiLCJDaGVja3MuaXNfc3RyaW5nIiwiQ2hlY2tzLmlzX251bWJlciIsIkNoZWNrcy5pc19ib29sZWFuIiwiQ2hlY2tzLmlzX251bGwiLCJDaGVja3MuaXNfYXJyYXkiLCJDaGVja3MuaXNfb2JqZWN0IiwiQ2hlY2tzLmlzX3ZhcmlhYmxlIiwiUmVzb2x2ZXJzLnJlc29sdmVWYXJpYWJsZSIsIkNoZWNrcy5pc193aWxkY2FyZCIsIlJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQiLCJDaGVja3MuaXNfdW5kZWZpbmVkIiwiQ2hlY2tzLmlzX2hlYWRUYWlsIiwiUmVzb2x2ZXJzLnJlc29sdmVIZWFkVGFpbCIsIkNoZWNrcy5pc19zdGFydHNXaXRoIiwiUmVzb2x2ZXJzLnJlc29sdmVTdGFydHNXaXRoIiwiQ2hlY2tzLmlzX2NhcHR1cmUiLCJSZXNvbHZlcnMucmVzb2x2ZUNhcHR1cmUiLCJDaGVja3MuaXNfYm91bmQiLCJSZXNvbHZlcnMucmVzb2x2ZUJvdW5kIiwiQ2hlY2tzLmlzX3R5cGUiLCJSZXNvbHZlcnMucmVzb2x2ZVR5cGUiLCJSZXNvbHZlcnMucmVzb2x2ZUFycmF5IiwiUmVzb2x2ZXJzLnJlc29sdmVOdW1iZXIiLCJSZXNvbHZlcnMucmVzb2x2ZVN0cmluZyIsIlJlc29sdmVycy5yZXNvbHZlQm9vbGVhbiIsIlJlc29sdmVycy5yZXNvbHZlU3ltYm9sIiwiUmVzb2x2ZXJzLnJlc29sdmVOdWxsIiwiQ2hlY2tzLmlzX2JpdHN0cmluZyIsIlJlc29sdmVycy5yZXNvbHZlQml0U3RyaW5nIiwiUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QiLCJSZXNvbHZlcnMucmVzb2x2ZU5vTWF0Y2giLCJUeXBlcy5WYXJpYWJsZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFFQSxNQUFNLFFBQU4sQ0FBZTs7Y0FFRCxnQkFBZ0IsT0FBTyxHQUFQLENBQVcsbUJBQVgsQ0FBNUIsRUFBNkQ7U0FDdEQsYUFBTCxHQUFxQixhQUFyQjs7OztBQUlKLE1BQU0sUUFBTixDQUFlO2dCQUNDOzs7QUFJaEIsTUFBTSxVQUFOLENBQWlCOztjQUVILE1BQVosRUFBb0I7U0FDYixNQUFMLEdBQWMsTUFBZDs7OztBQUlKLE1BQU0sT0FBTixDQUFjOztjQUVBLEtBQVosRUFBbUI7U0FDWixLQUFMLEdBQWEsS0FBYjs7OztBQUlKLE1BQU0sUUFBTixDQUFlO2dCQUNDOzs7QUFJaEIsTUFBTSxJQUFOLENBQVc7O2NBRUcsSUFBWixFQUFrQixhQUFhLEVBQS9CLEVBQW1DO1NBQzVCLElBQUwsR0FBWSxJQUFaO1NBQ0ssVUFBTCxHQUFrQixVQUFsQjs7OztBQUlKLE1BQU0sS0FBTixDQUFZOztjQUVFLEtBQVosRUFBbUI7U0FDWixLQUFMLEdBQWEsS0FBYjs7OztBQUlKLE1BQU0sY0FBTixDQUFxQjs7Y0FFUCxHQUFHLE1BQWYsRUFBc0I7U0FDZixNQUFMLEdBQWMsTUFBZDs7O1dBR087V0FDQSxPQUFPLE1BQWQ7OzthQUdTO1dBQ0YsS0FBSyxTQUFMLEtBQW1CLENBQTFCOzs7Y0FHUztRQUNMLElBQUksQ0FBUjs7U0FFSSxJQUFJLEdBQVIsSUFBZSxLQUFLLE1BQXBCLEVBQTJCO1VBQ3JCLElBQU0sSUFBSSxJQUFKLEdBQVcsSUFBSSxJQUFoQixHQUFzQixDQUEvQjs7O1dBR0ssQ0FBUDs7O1dBR08sS0FBVCxFQUFlO1dBQ04sS0FBSyxNQUFMLENBQVksS0FBWixDQUFQOzs7aUJBR2EsS0FBZixFQUFxQjtRQUNmLE1BQU0sS0FBSyxRQUFMLENBQWMsS0FBZCxDQUFWO1dBQ08sSUFBSSxJQUFKLEdBQVcs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