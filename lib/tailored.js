'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ErlangTypes = _interopDefault(require('erlang-types'));

/* @flow */

class Variable {
  constructor(name = null, default_value = Symbol.for('tailored.no_value')) {
    this.name = name;
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

class NamedVariableResult {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
}

function variable(name = null, default_value = Symbol.for('tailored.no_value')) {
  return new Variable(name, default_value);
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

function namedVariableResult(name, value) {
  return new NamedVariableResult(name, value);
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

function resolveVariable(pattern) {
  return function (value, args) {
    if (pattern.name === null || pattern.name.startsWith('_')) {
      args.push(value);
    } else {
      args.push(namedVariableResult(pattern.name, value));
    }

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
      return matches(value, args);
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
      let mappedValues = arg.map(x => {
        if (x === null) {
          return 'null';
        } else if (typeof x === 'undefined') {
          return 'undefined';
        }

        return x.toString();
      });

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

        const doesMatch = processedClause.pattern(args, result);
        const [filteredResult, allNamesMatch] = checkNamedVariables(result);

        if (doesMatch && allNamesMatch && (await processedClause.guard.apply(this, result))) {
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

      const doesMatch = processedClause.pattern(args, result);
      const [filteredResult, allNamesMatch] = checkNamedVariables(result);

      if (doesMatch && allNamesMatch && processedClause.guard.apply(this, filteredResult)) {
        funcToCall = processedClause.fn;
        params = filteredResult;
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
  const doesMatch = processedPattern(expr, result);
  const [filteredResult, allNamesMatch] = checkNamedVariables(result);

  if (doesMatch && allNamesMatch && guard.apply(this, filteredResult)) {
    return filteredResult;
  } else {
    console.error('No match for:', expr);
    throw new MatchError(expr);
  }
}

function checkNamedVariables(results) {
  const namesMap = {};
  const filteredResults = [];

  for (let i = 0; i < results.length; i++) {
    const current = results[i];
    if (current instanceof NamedVariableResult) {
      if (namesMap[current.name] && namesMap[current.name] !== current.value) {
        return [results, false];
      } else if (namesMap[current.name] && namesMap[current.name] === current.value) {
        filteredResults.push(current.value);
      } else {
        namesMap[current.name] = current.value;
        filteredResults.push(current.value);
      }
    } else {
      filteredResults.push(current);
    }
  }

  return [filteredResults, true];
}

function match_or_default(pattern, expr, guard = () => true, default_value = null) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  const doesMatch = processedPattern(expr, result);
  const [filteredResult, allNamesMatch] = checkNamedVariables(result);

  if (doesMatch && allNamesMatch && guard.apply(this, filteredResult)) {
    return filteredResult;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcbiAgY29uc3RydWN0b3IobmFtZSA9IG51bGwsIGRlZmF1bHRfdmFsdWUgPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmRlZmF1bHRfdmFsdWUgPSBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG5cbmNsYXNzIFdpbGRjYXJkIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBTdGFydHNXaXRoIHtcbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cbn1cblxuY2xhc3MgQ2FwdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBUeXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgQml0U3RyaW5nTWF0Y2gge1xuICBjb25zdHJ1Y3RvciguLi52YWx1ZXMpIHtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpIHtcbiAgICBsZXQgcyA9IDA7XG5cbiAgICBmb3IgKGxldCB2YWwgb2YgdGhpcy52YWx1ZXMpIHtcbiAgICAgIHMgPSBzICsgdmFsLnVuaXQgKiB2YWwuc2l6ZSAvIDg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBnZXRWYWx1ZShpbmRleCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcyhpbmRleCk7XG4gIH1cblxuICBnZXRTaXplT2ZWYWx1ZShpbmRleCkge1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0VmFsdWUoaW5kZXgpLnR5cGU7XG4gIH1cbn1cblxuY2xhc3MgTmFtZWRWYXJpYWJsZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFyaWFibGUoXG4gIG5hbWUgPSBudWxsLFxuICBkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUobmFtZSwgZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcykge1xuICByZXR1cm4gbmV3IEJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyk7XG59XG5cbmZ1bmN0aW9uIG5hbWVkVmFyaWFibGVSZXN1bHQobmFtZSwgdmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBOYW1lZFZhcmlhYmxlUmVzdWx0KG5hbWUsIHZhbHVlKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2gsXG4gIE5hbWVkVmFyaWFibGVSZXN1bHQsXG4gIG5hbWVkVmFyaWFibGVSZXN1bHRcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdHlwZXMnO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbn1cblxuZnVuY3Rpb24gaXNfYm9vbGVhbih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbic7XG59XG5cbmZ1bmN0aW9uIGlzX3N5bWJvbCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3ltYm9sJztcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19vYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCc7XG59XG5cbmZ1bmN0aW9uIGlzX3ZhcmlhYmxlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFZhcmlhYmxlO1xufVxuXG5mdW5jdGlvbiBpc193aWxkY2FyZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBXaWxkY2FyZDtcbn1cblxuZnVuY3Rpb24gaXNfaGVhZFRhaWwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSGVhZFRhaWw7XG59XG5cbmZ1bmN0aW9uIGlzX2NhcHR1cmUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQ2FwdHVyZTtcbn1cblxuZnVuY3Rpb24gaXNfdHlwZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBUeXBlO1xufVxuXG5mdW5jdGlvbiBpc19zdGFydHNXaXRoKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFN0YXJ0c1dpdGg7XG59XG5cbmZ1bmN0aW9uIGlzX2JvdW5kKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJvdW5kO1xufVxuXG5mdW5jdGlvbiBpc19iaXRzdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nTWF0Y2g7XG59XG5cbmZ1bmN0aW9uIGlzX251bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2Z1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbmV4cG9ydCB7XG4gIGlzX251bWJlcixcbiAgaXNfc3RyaW5nLFxuICBpc19ib29sZWFuLFxuICBpc19zeW1ib2wsXG4gIGlzX251bGwsXG4gIGlzX3VuZGVmaW5lZCxcbiAgaXNfZnVuY3Rpb24sXG4gIGlzX3ZhcmlhYmxlLFxuICBpc193aWxkY2FyZCxcbiAgaXNfaGVhZFRhaWwsXG4gIGlzX2NhcHR1cmUsXG4gIGlzX3R5cGUsXG4gIGlzX3N0YXJ0c1dpdGgsXG4gIGlzX2JvdW5kLFxuICBpc19vYmplY3QsXG4gIGlzX2FycmF5LFxuICBpc19iaXRzdHJpbmcsXG59O1xuIiwiLyogQGZsb3cgKi9cblxuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gJy4vY2hlY2tzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gJ2VybGFuZy10eXBlcyc7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdW1iZXIocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19mdW5jdGlvbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdWxsKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChwYXR0ZXJuLm5hbWUgPT09IG51bGwgfHwgcGF0dGVybi5uYW1lLnN0YXJ0c1dpdGgoJ18nKSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJncy5wdXNoKFR5cGVzLm5hbWVkVmFyaWFibGVSZXN1bHQocGF0dGVybi5uYW1lLCB2YWx1ZSkpO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSGVhZFRhaWwoKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPCAyKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZCA9IHZhbHVlWzBdO1xuICAgIGNvbnN0IHRhaWwgPSB2YWx1ZS5zbGljZSgxKTtcblxuICAgIGFyZ3MucHVzaChoZWFkKTtcbiAgICBhcmdzLnB1c2godGFpbCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUNhcHR1cmUocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLnZhbHVlKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAobWF0Y2hlcyh2YWx1ZSwgYXJncykpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdGFydHNXaXRoKHBhdHRlcm4pIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmIHZhbHVlLnN0YXJ0c1dpdGgocHJlZml4KSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVUeXBlKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybi50eXBlKSB7XG4gICAgICBjb25zdCBtYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLm9ialBhdHRlcm4pO1xuICAgICAgcmV0dXJuIG1hdGNoZXModmFsdWUsIGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUFycmF5KHBhdHRlcm4pIHtcbiAgY29uc3QgbWF0Y2hlcyA9IHBhdHRlcm4ubWFwKHggPT4gYnVpbGRNYXRjaCh4KSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCAhPSBwYXR0ZXJuLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZS5ldmVyeShmdW5jdGlvbih2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPYmplY3QocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IHt9O1xuXG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwYXR0ZXJuKS5jb25jYXQoXG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhwYXR0ZXJuKVxuICApO1xuXG4gIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfb2JqZWN0KHZhbHVlKSB8fCBwYXR0ZXJuLmxlbmd0aCA+IHZhbHVlLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgICBpZiAoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IgKGxldCBiaXRzdHJpbmdNYXRjaFBhcnQgb2YgcGF0dGVybi52YWx1ZXMpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpIHtcbiAgICAgIGxldCBzaXplID0gZ2V0U2l6ZShiaXRzdHJpbmdNYXRjaFBhcnQudW5pdCwgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUpO1xuICAgICAgZmlsbEFycmF5KHBhdHRlcm5CaXRTdHJpbmcsIHNpemUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQoXG4gICAgICAgIG5ldyBCaXRTdHJpbmcoYml0c3RyaW5nTWF0Y2hQYXJ0KS52YWx1ZVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBsZXQgcGF0dGVyblZhbHVlcyA9IHBhdHRlcm4udmFsdWVzO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGxldCBic1ZhbHVlID0gbnVsbDtcblxuICAgIGlmICghQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgISh2YWx1ZSBpbnN0YW5jZW9mIEJpdFN0cmluZykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkpIHtcbiAgICAgIGJzVmFsdWUgPSBuZXcgQml0U3RyaW5nKEJpdFN0cmluZy5iaW5hcnkodmFsdWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnNWYWx1ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGxldCBiZWdpbm5pbmdJbmRleCA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBiaXRzdHJpbmdNYXRjaFBhcnQgPSBwYXR0ZXJuVmFsdWVzW2ldO1xuXG4gICAgICBpZiAoXG4gICAgICAgIENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpICYmXG4gICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC50eXBlID09ICdiaW5hcnknICYmXG4gICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5zaXplID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnYSBiaW5hcnkgZmllbGQgd2l0aG91dCBzaXplIGlzIG9ubHkgYWxsb3dlZCBhdCB0aGUgZW5kIG9mIGEgYmluYXJ5IHBhdHRlcm4nXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGxldCBzaXplID0gMDtcbiAgICAgIGxldCBic1ZhbHVlQXJyYXlQYXJ0ID0gW107XG4gICAgICBsZXQgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IFtdO1xuICAgICAgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcblxuICAgICAgaWYgKGkgPT09IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICBic1ZhbHVlQXJyYXlQYXJ0ID0gYnNWYWx1ZS52YWx1ZS5zbGljZShiZWdpbm5pbmdJbmRleCk7XG4gICAgICAgIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBwYXR0ZXJuQml0U3RyaW5nLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKFxuICAgICAgICAgIGJlZ2lubmluZ0luZGV4LFxuICAgICAgICAgIGJlZ2lubmluZ0luZGV4ICsgc2l6ZVxuICAgICAgICApO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemVcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpKSB7XG4gICAgICAgIHN3aXRjaCAoYml0c3RyaW5nTWF0Y2hQYXJ0LnR5cGUpIHtcbiAgICAgICAgICBjYXNlICdpbnRlZ2VyJzpcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LmF0dHJpYnV0ZXMgJiZcbiAgICAgICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LmF0dHJpYnV0ZXMuaW5kZXhPZignc2lnbmVkJykgIT0gLTFcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IEludDhBcnJheShbYnNWYWx1ZUFycmF5UGFydFswXV0pWzBdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgVWludDhBcnJheShbYnNWYWx1ZUFycmF5UGFydFswXV0pWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnZmxvYXQnOlxuICAgICAgICAgICAgaWYgKHNpemUgPT09IDY0KSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChGbG9hdDY0QXJyYXkuZnJvbShic1ZhbHVlQXJyYXlQYXJ0KVswXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNpemUgPT09IDMyKSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChGbG9hdDMyQXJyYXkuZnJvbShic1ZhbHVlQXJyYXlQYXJ0KVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpdHN0cmluZyc6XG4gICAgICAgICAgICBhcmdzLnB1c2goY3JlYXRlQml0U3RyaW5nKGJzVmFsdWVBcnJheVBhcnQpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmMTYnOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50MTZBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjMyJzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDMyQXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFhcnJheXNFcXVhbChic1ZhbHVlQXJyYXlQYXJ0LCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGJlZ2lubmluZ0luZGV4ID0gYmVnaW5uaW5nSW5kZXggKyBzaXplO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRTaXplKHVuaXQsIHNpemUpIHtcbiAgcmV0dXJuIHVuaXQgKiBzaXplIC8gODtcbn1cblxuZnVuY3Rpb24gYXJyYXlzRXF1YWwoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmIChhLmxlbmd0aCAhPSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbEFycmF5KGFyciwgbnVtKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtOyBpKyspIHtcbiAgICBhcnIucHVzaCgwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVCaXRTdHJpbmcoYXJyKSB7XG4gIGxldCBpbnRlZ2VyUGFydHMgPSBhcnIubWFwKGVsZW0gPT4gQml0U3RyaW5nLmludGVnZXIoZWxlbSkpO1xuICByZXR1cm4gbmV3IEJpdFN0cmluZyguLi5pbnRlZ2VyUGFydHMpO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTm9NYXRjaCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZXhwb3J0IHtcbiAgcmVzb2x2ZUJvdW5kLFxuICByZXNvbHZlV2lsZGNhcmQsXG4gIHJlc29sdmVWYXJpYWJsZSxcbiAgcmVzb2x2ZUhlYWRUYWlsLFxuICByZXNvbHZlQ2FwdHVyZSxcbiAgcmVzb2x2ZVN0YXJ0c1dpdGgsXG4gIHJlc29sdmVUeXBlLFxuICByZXNvbHZlQXJyYXksXG4gIHJlc29sdmVPYmplY3QsXG4gIHJlc29sdmVOb01hdGNoLFxuICByZXNvbHZlU3ltYm9sLFxuICByZXNvbHZlU3RyaW5nLFxuICByZXNvbHZlTnVtYmVyLFxuICByZXNvbHZlQm9vbGVhbixcbiAgcmVzb2x2ZUZ1bmN0aW9uLFxuICByZXNvbHZlTnVsbCxcbiAgcmVzb2x2ZUJpdFN0cmluZ1xufTtcbiIsImltcG9ydCAqIGFzIFJlc29sdmVycyBmcm9tICcuL3Jlc29sdmVycyc7XG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBwYXR0ZXJuTWFwID0gbmV3IE1hcCgpO1xucGF0dGVybk1hcC5zZXQoVmFyaWFibGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVZhcmlhYmxlKTtcbnBhdHRlcm5NYXAuc2V0KFdpbGRjYXJkLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZCk7XG5wYXR0ZXJuTWFwLnNldChIZWFkVGFpbC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwpO1xucGF0dGVybk1hcC5zZXQoU3RhcnRzV2l0aC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aCk7XG5wYXR0ZXJuTWFwLnNldChDYXB0dXJlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKTtcbnBhdHRlcm5NYXAuc2V0KEJvdW5kLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCb3VuZCk7XG5wYXR0ZXJuTWFwLnNldChUeXBlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVUeXBlKTtcbnBhdHRlcm5NYXAuc2V0KEJpdFN0cmluZ01hdGNoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoTnVtYmVyLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVOdW1iZXIpO1xucGF0dGVybk1hcC5zZXQoU3ltYm9sLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTeW1ib2wpO1xucGF0dGVybk1hcC5zZXQoQXJyYXkucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUFycmF5KTtcbnBhdHRlcm5NYXAuc2V0KFN0cmluZy5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RyaW5nKTtcbnBhdHRlcm5NYXAuc2V0KEJvb2xlYW4ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvb2xlYW4pO1xucGF0dGVybk1hcC5zZXQoRnVuY3Rpb24ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUZ1bmN0aW9uKTtcbnBhdHRlcm5NYXAuc2V0KE9iamVjdC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlT2JqZWN0KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkTWF0Y2gocGF0dGVybikge1xuICBpZiAocGF0dGVybiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBjb25zdCB0eXBlID0gcGF0dGVybi5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG4gIGNvbnN0IHJlc29sdmVyID0gcGF0dGVybk1hcC5nZXQodHlwZSk7XG5cbiAgaWYgKHJlc29sdmVyKSB7XG4gICAgcmV0dXJuIHJlc29sdmVyKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU9iamVjdChwYXR0ZXJuKTtcbiAgfVxuXG4gIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU5vTWF0Y2goKTtcbn1cbiIsImltcG9ydCB7IGJ1aWxkTWF0Y2ggfSBmcm9tICcuL21hdGNoJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBGVU5DID0gU3ltYm9sKCk7XG5cbmV4cG9ydCBjbGFzcyBNYXRjaEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihhcmcpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnKSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAgIGxldCBtYXBwZWRWYWx1ZXMgPSBhcmcubWFwKHggPT4ge1xuICAgICAgICBpZiAoeCA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHggPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgcmV0dXJuICd1bmRlZmluZWQnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHgudG9TdHJpbmcoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hnZW4oLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIHlpZWxkKiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEdlbiguLi5hcmdzKSB7XG4gIHJldHVybiBkZWZtYXRjaGdlbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoQXN5bmMoLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgICBhcmdzLFxuICAgICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KTtcbiAgICAgICAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgZG9lc01hdGNoICYmXG4gICAgICAgICAgYWxsTmFtZXNNYXRjaCAmJlxuICAgICAgICAgIChhd2FpdCBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcykge1xuICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgbGV0IGZ1bmNUb0NhbGwgPSBudWxsO1xuICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgYXJncyxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmFyaXR5LFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICApO1xuXG4gICAgICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpO1xuICAgICAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICAgICAgaWYgKFxuICAgICAgICBkb2VzTWF0Y2ggJiZcbiAgICAgICAgYWxsTmFtZXNNYXRjaCAmJlxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpXG4gICAgICApIHtcbiAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgcGFyYW1zID0gZmlsdGVyZWRSZXN1bHQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFtmdW5jVG9DYWxsLCBwYXJhbXNdO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBcml0eU1hcChjbGF1c2VzKSB7XG4gIGxldCBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgZm9yIChjb25zdCBjbGF1c2Ugb2YgY2xhdXNlcykge1xuICAgIGNvbnN0IHJhbmdlID0gZ2V0QXJpdHlSYW5nZShjbGF1c2UpO1xuXG4gICAgZm9yIChjb25zdCBhcml0eSBvZiByYW5nZSkge1xuICAgICAgbGV0IGFyaXR5Q2xhdXNlcyA9IFtdO1xuXG4gICAgICBpZiAobWFwLmhhcyhhcml0eSkpIHtcbiAgICAgICAgYXJpdHlDbGF1c2VzID0gbWFwLmdldChhcml0eSk7XG4gICAgICB9XG5cbiAgICAgIGFyaXR5Q2xhdXNlcy5wdXNoKGNsYXVzZSk7XG4gICAgICBtYXAuc2V0KGFyaXR5LCBhcml0eUNsYXVzZXMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXA7XG59XG5cbmZ1bmN0aW9uIGdldEFyaXR5UmFuZ2UoY2xhdXNlKSB7XG4gIGNvbnN0IG1pbiA9IGNsYXVzZS5hcml0eSAtIGNsYXVzZS5vcHRpb25hbHMubGVuZ3RoO1xuICBjb25zdCBtYXggPSBjbGF1c2UuYXJpdHk7XG5cbiAgbGV0IHJhbmdlID0gW21pbl07XG5cbiAgd2hpbGUgKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICE9IG1heCkge1xuICAgIHJhbmdlLnB1c2gocmFuZ2VbcmFuZ2UubGVuZ3RoIC0gMV0gKyAxKTtcbiAgfVxuXG4gIHJldHVybiByYW5nZTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybikge1xuICBsZXQgb3B0aW9uYWxzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFxuICAgICAgcGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmXG4gICAgICBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWUgIT0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuICAgICkge1xuICAgICAgb3B0aW9uYWxzLnB1c2goW2ksIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvcHRpb25hbHM7XG59XG5cbmZ1bmN0aW9uIGZpbGxJbk9wdGlvbmFsVmFsdWVzKGFyZ3MsIGFyaXR5LCBvcHRpb25hbHMpIHtcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSB8fCBvcHRpb25hbHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBpZiAoYXJncy5sZW5ndGggKyBvcHRpb25hbHMubGVuZ3RoIDwgYXJpdHkpIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGxldCBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCA9IGFyaXR5IC0gYXJncy5sZW5ndGg7XG4gIGxldCBvcHRpb25hbHNUb1JlbW92ZSA9IG9wdGlvbmFscy5sZW5ndGggLSBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbDtcblxuICBsZXQgb3B0aW9uYWxzVG9Vc2UgPSBvcHRpb25hbHMuc2xpY2Uob3B0aW9uYWxzVG9SZW1vdmUpO1xuXG4gIGZvciAobGV0IFtpbmRleCwgdmFsdWVdIG9mIG9wdGlvbmFsc1RvVXNlKSB7XG4gICAgYXJncy5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKTtcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5KSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJncztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm4sIGV4cHIsIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpO1xuICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuXG4gIGlmIChkb2VzTWF0Y2ggJiYgYWxsTmFtZXNNYXRjaCAmJiBndWFyZC5hcHBseSh0aGlzLCBmaWx0ZXJlZFJlc3VsdCkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGV4cHIpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGV4cHIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0cykge1xuICBjb25zdCBuYW1lc01hcCA9IHt9O1xuICBjb25zdCBmaWx0ZXJlZFJlc3VsdHMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjdXJyZW50ID0gcmVzdWx0c1tpXTtcbiAgICBpZiAoY3VycmVudCBpbnN0YW5jZW9mIFR5cGVzLk5hbWVkVmFyaWFibGVSZXN1bHQpIHtcbiAgICAgIGlmIChuYW1lc01hcFtjdXJyZW50Lm5hbWVdICYmIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gIT09IGN1cnJlbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIFtyZXN1bHRzLCBmYWxzZV07XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdICYmXG4gICAgICAgIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gPT09IGN1cnJlbnQudmFsdWVcbiAgICAgICkge1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChjdXJyZW50LnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gPSBjdXJyZW50LnZhbHVlO1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChjdXJyZW50LnZhbHVlKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFtmaWx0ZXJlZFJlc3VsdHMsIHRydWVdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hfb3JfZGVmYXVsdChcbiAgcGF0dGVybixcbiAgZXhwcixcbiAgZ3VhcmQgPSAoKSA9PiB0cnVlLFxuICBkZWZhdWx0X3ZhbHVlID0gbnVsbFxuKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCk7XG4gIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgaWYgKGRvZXNNYXRjaCAmJiBhbGxOYW1lc01hdGNoICYmIGd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSkge1xuICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgbWF0Y2hfb3JfZGVmYXVsdCB9IGZyb20gXCIuL2RlZm1hdGNoXCI7XG5pbXBvcnQgRXJsYW5nVHlwZXMgZnJvbSBcImVybGFuZy10eXBlc1wiO1xuXG5jb25zdCBOT19NQVRDSCA9IFN5bWJvbCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2dlbmVyYXRvcihwYXR0ZXJuLCBiaXRzdHJpbmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBsZXQgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZSgwLCBwYXR0ZXJuLmJ5dGVfc2l6ZSgpKTtcbiAgICBsZXQgaSA9IDE7XG5cbiAgICB3aGlsZSAoYnNTbGljZS5ieXRlX3NpemUgPT0gcGF0dGVybi5ieXRlX3NpemUoKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBic1NsaWNlLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG5cbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2gocmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZShcbiAgICAgICAgcGF0dGVybi5ieXRlX3NpemUoKSAqIGksXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiAoaSArIDEpXG4gICAgICApO1xuXG4gICAgICBpKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfZ2VuZXJhdG9yKHBhdHRlcm4sIGxpc3QpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBmb3IgKGxldCBpIG9mIGxpc3QpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgaSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuICAgICAgaWYgKHJlc3VsdCAhPSBOT19NQVRDSCkge1xuICAgICAgICBjb25zdCBbdmFsdWVdID0gcmVzdWx0O1xuICAgICAgICByZXR1cm5SZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfY29tcHJlaGVuc2lvbihleHByZXNzaW9uLCBnZW5lcmF0b3JzKSB7XG4gIGNvbnN0IGdlbmVyYXRlZFZhbHVlcyA9IHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvcnMucG9wKCkoKSwgZ2VuZXJhdG9ycyk7XG5cbiAgbGV0IHJlc3VsdCA9IFtdO1xuXG4gIGZvciAobGV0IHZhbHVlIG9mIGdlbmVyYXRlZFZhbHVlcykge1xuICAgIGlmIChleHByZXNzaW9uLmd1YXJkLmFwcGx5KHRoaXMsIHZhbHVlKSkge1xuICAgICAgcmVzdWx0LnB1c2goZXhwcmVzc2lvbi5mbi5hcHBseSh0aGlzLCB2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvciwgZ2VuZXJhdG9ycykge1xuICBpZiAoZ2VuZXJhdG9ycy5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBnZW5lcmF0b3IubWFwKHggPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoeCkpIHtcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW3hdO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGxpc3QgPSBnZW5lcmF0b3JzLnBvcCgpO1xuXG4gICAgbGV0IG5leHRfZ2VuID0gW107XG4gICAgZm9yIChsZXQgaiBvZiBsaXN0KCkpIHtcbiAgICAgIGZvciAobGV0IGkgb2YgZ2VuZXJhdG9yKSB7XG4gICAgICAgIG5leHRfZ2VuLnB1c2goW2pdLmNvbmNhdChpKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJ1bl9nZW5lcmF0b3JzKG5leHRfZ2VuLCBnZW5lcmF0b3JzKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXN1bHQgPSByZXN1bHQubWFwKHggPT4gRXJsYW5nVHlwZXMuQml0U3RyaW5nLmludGVnZXIoeCkpO1xuICByZXR1cm4gbmV3IEVybGFuZ1R5cGVzLkJpdFN0cmluZyguLi5yZXN1bHQpO1xufVxuIiwiaW1wb3J0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgZGVmbWF0Y2hnZW4sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jLFxufSBmcm9tICcuL3RhaWxvcmVkL2RlZm1hdGNoJztcbmltcG9ydCB7XG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaCxcbn0gZnJvbSAnLi90YWlsb3JlZC90eXBlcyc7XG5cbmltcG9ydCB7XG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGJpdHN0cmluZ19nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uLFxufSBmcm9tICcuL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zJztcblxuZXhwb3J0IGRlZmF1bHQge1xuICBkZWZtYXRjaCxcbiAgbWF0Y2gsXG4gIE1hdGNoRXJyb3IsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgYml0U3RyaW5nTWF0Y2gsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbiAgZGVmbWF0Y2hHZW4sXG4gIGRlZm1hdGNoQXN5bmMsXG59O1xuIl0sIm5hbWVzIjpbIlZhcmlhYmxlIiwibmFtZSIsImRlZmF1bHRfdmFsdWUiLCJTeW1ib2wiLCJmb3IiLCJXaWxkY2FyZCIsIlN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJDYXB0dXJlIiwidmFsdWUiLCJIZWFkVGFpbCIsIlR5cGUiLCJ0eXBlIiwib2JqUGF0dGVybiIsIkJvdW5kIiwiQml0U3RyaW5nTWF0Y2giLCJ2YWx1ZXMiLCJsZW5ndGgiLCJieXRlX3NpemUiLCJzIiwidmFsIiwidW5pdCIsInNpemUiLCJpbmRleCIsImdldFZhbHVlIiwiTmFtZWRWYXJpYWJsZVJlc3VsdCIsInZhcmlhYmxlIiwid2lsZGNhcmQiLCJzdGFydHNXaXRoIiwiY2FwdHVyZSIsImhlYWRUYWlsIiwiYm91bmQiLCJiaXRTdHJpbmdNYXRjaCIsIm5hbWVkVmFyaWFibGVSZXN1bHQiLCJpc19udW1iZXIiLCJpc19zdHJpbmciLCJpc19ib29sZWFuIiwiaXNfc3ltYm9sIiwiaXNfb2JqZWN0IiwiaXNfdmFyaWFibGUiLCJpc19udWxsIiwiaXNfYXJyYXkiLCJBcnJheSIsImlzQXJyYXkiLCJpc19mdW5jdGlvbiIsIk9iamVjdCIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiY2FsbCIsIkJpdFN0cmluZyIsIkVybGFuZ1R5cGVzIiwicmVzb2x2ZVN5bWJvbCIsInBhdHRlcm4iLCJDaGVja3MiLCJyZXNvbHZlU3RyaW5nIiwicmVzb2x2ZU51bWJlciIsInJlc29sdmVCb29sZWFuIiwicmVzb2x2ZUZ1bmN0aW9uIiwicmVzb2x2ZU51bGwiLCJyZXNvbHZlQm91bmQiLCJhcmdzIiwicmVzb2x2ZVdpbGRjYXJkIiwicmVzb2x2ZVZhcmlhYmxlIiwicHVzaCIsIlR5cGVzIiwicmVzb2x2ZUhlYWRUYWlsIiwiaGVhZCIsInRhaWwiLCJzbGljZSIsInJlc29sdmVDYXB0dXJlIiwibWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJyZXNvbHZlU3RhcnRzV2l0aCIsInN1YnN0cmluZyIsInJlc29sdmVUeXBlIiwicmVzb2x2ZUFycmF5IiwibWFwIiwieCIsImV2ZXJ5IiwidiIsImkiLCJyZXNvbHZlT2JqZWN0Iiwia2V5cyIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsImtleSIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiZnJvbSIsIkZsb2F0MzJBcnJheSIsImNyZWF0ZUJpdFN0cmluZyIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImFwcGx5IiwiVWludDE2QXJyYXkiLCJVaW50MzJBcnJheSIsImFycmF5c0VxdWFsIiwiYSIsImIiLCJmaWxsQXJyYXkiLCJhcnIiLCJudW0iLCJpbnRlZ2VyUGFydHMiLCJlbGVtIiwiaW50ZWdlciIsInJlc29sdmVOb01hdGNoIiwicGF0dGVybk1hcCIsIk1hcCIsInNldCIsIlJlc29sdmVycyIsIk51bWJlciIsIkJvb2xlYW4iLCJGdW5jdGlvbiIsImNvbnN0cnVjdG9yIiwicmVzb2x2ZXIiLCJnZXQiLCJNYXRjaEVycm9yIiwiYXJnIiwibWVzc2FnZSIsIm1hcHBlZFZhbHVlcyIsInN0YWNrIiwiQ2xhdXNlIiwiZm4iLCJndWFyZCIsImFyaXR5Iiwib3B0aW9uYWxzIiwiZ2V0T3B0aW9uYWxWYWx1ZXMiLCJjbGF1c2UiLCJkZWZtYXRjaCIsImNsYXVzZXMiLCJhcml0aWVzIiwiZ2V0QXJpdHlNYXAiLCJmdW5jVG9DYWxsIiwicGFyYW1zIiwiZmluZE1hdGNoaW5nRnVuY3Rpb24iLCJkZWZtYXRjaGdlbiIsImRlZm1hdGNoR2VuIiwiZGVmbWF0Y2hBc3luYyIsImhhcyIsImFyaXR5Q2xhdXNlcyIsInByb2Nlc3NlZENsYXVzZSIsInJlc3VsdCIsImZpbGxJbk9wdGlvbmFsVmFsdWVzIiwiZG9lc01hdGNoIiwiZmlsdGVyZWRSZXN1bHQiLCJhbGxOYW1lc01hdGNoIiwiY2hlY2tOYW1lZFZhcmlhYmxlcyIsImVycm9yIiwicmFuZ2UiLCJnZXRBcml0eVJhbmdlIiwibWluIiwibWF4IiwibnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwiLCJvcHRpb25hbHNUb1JlbW92ZSIsIm9wdGlvbmFsc1RvVXNlIiwic3BsaWNlIiwibWF0Y2giLCJleHByIiwicHJvY2Vzc2VkUGF0dGVybiIsInJlc3VsdHMiLCJuYW1lc01hcCIsImZpbHRlcmVkUmVzdWx0cyIsImN1cnJlbnQiLCJtYXRjaF9vcl9kZWZhdWx0IiwiTk9fTUFUQ0giLCJiaXRzdHJpbmdfZ2VuZXJhdG9yIiwiYml0c3RyaW5nIiwicmV0dXJuUmVzdWx0IiwiYnNTbGljZSIsImxpc3RfZ2VuZXJhdG9yIiwibGlzdCIsImxpc3RfY29tcHJlaGVuc2lvbiIsImV4cHJlc3Npb24iLCJnZW5lcmF0b3JzIiwiZ2VuZXJhdGVkVmFsdWVzIiwicnVuX2dlbmVyYXRvcnMiLCJwb3AiLCJnZW5lcmF0b3IiLCJuZXh0X2dlbiIsImoiLCJiaXRzdHJpbmdfY29tcHJlaGVuc2lvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7O0FBRUEsTUFBTUEsUUFBTixDQUFlO2NBQ0RDLE9BQU8sSUFBbkIsRUFBeUJDLGdCQUFnQkMsT0FBT0MsR0FBUCxDQUFXLG1CQUFYLENBQXpDLEVBQTBFO1NB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
