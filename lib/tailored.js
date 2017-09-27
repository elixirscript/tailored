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
  constructor(head, tail) {
    this.head = head;
    this.tail = tail;
  }
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

function headTail(head, tail) {
  return new HeadTail(head, tail);
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

function is_bitstring(value) {
  return value instanceof BitStringMatch;
}

function is_null(value) {
  return value === null;
}

function is_array(value) {
  return Array.isArray(value);
}

function is_function(value) {
  return typeof value === 'function' || value instanceof Function;
}

function is_map(value) {
  return value instanceof Map;
}

function is_pid(value) {
  return value instanceof ErlangTypes.PID;
}

function is_tuple(value) {
  return value instanceof ErlangTypes.Tuple;
}

function is_reference(value) {
  return value instanceof ErlangTypes.Reference;
}

function arrayEquals(left, right) {
  if (!Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i++) {
    if (equals(left[i], right[i]) === false) {
      return false;
    }
  }

  return true;
}

function tupleEquals(left, right) {
  if (right instanceof ErlangTypes.Tuple === false) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  return arrayEquals(left.values, right.values);
}

function bitstringEquals(left, right) {
  if (right instanceof ErlangTypes.BitString === false) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  return arrayEquals(left.value, right.value);
}

function pidEquals(left, right) {
  if (right instanceof ErlangTypes.PID === false) {
    return false;
  }

  return left.id === right.id;
}

function referenceEquals(left, right) {
  if (right instanceof ErlangTypes.Reference === false) {
    return false;
  }

  return left.id === right.id;
}

function mapEquals(left, right) {
  if (right instanceof Map === false) {
    return false;
  }

  const leftEntries = Array.from(left.entries());
  const rightEntries = Array.from(right.entries());

  return arrayEquals(leftEntries, rightEntries);
}

function equals(left, right) {
  if (Array.isArray(left)) {
    return arrayEquals(left, right);
  }

  if (left instanceof ErlangTypes.Tuple) {
    return tupleEquals(left, right);
  }

  if (left instanceof ErlangTypes.PID) {
    return pidEquals(left, right);
  }

  if (left instanceof ErlangTypes.BitString) {
    return bitstringEquals(left, right);
  }

  if (left instanceof ErlangTypes.Reference) {
    return referenceEquals(left, right);
  }

  if (left instanceof Map) {
    return mapEquals(left, right);
  }

  return left === right;
}

function is_non_primitive(key) {
  return is_array(key) || is_map(key) || is_pid(key) || is_reference(key) || is_bitstring(key) || is_tuple(key);
}

function has(map, key) {
  if (is_non_primitive(key)) {
    for (const map_key of map.keys()) {
      if (equals(map_key, key)) {
        return true;
      }
    }

    return false;
  }

  return map.has(key);
}

function get(map, key) {
  if (is_non_primitive(key)) {
    for (const map_key of map.keys()) {
      if (equals(map_key, key)) {
        return map.get(map_key);
      }
    }

    return null;
  }

  return map.get(key);
}

var Utils = {
  get,
  has,
  equals
};

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
    if (pattern.name === null) {
      args.push(value);
    } else if (pattern.name !== '_') {
      args.push(namedVariableResult(pattern.name, value));
    }

    return true;
  };
}

function resolveHeadTail(pattern) {
  const headMatches = buildMatch(pattern.head);
  const tailMatches = buildMatch(pattern.tail);

  return function (value, args) {
    if (!is_array(value) || value.length === 0) {
      return false;
    }

    const head = value[0];
    const tail = value.slice(1);

    if (headMatches(head, args) && tailMatches(tail, args)) {
      return true;
    }

    return false;
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

function resolveMap(pattern) {
  let matches = new Map();

  const keys = Array.from(pattern.keys());

  for (let key of keys) {
    matches.set(key, buildMatch(pattern.get(key)));
  }

  return function (value, args) {
    if (!is_map(value) || pattern.size > value.size) {
      return false;
    }

    for (const key of keys) {
      if (!Utils.has(value, key) || !Utils.get(matches, key)(Utils.get(value, key), args)) {
        return false;
      }
    }

    return true;
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
patternMap.set(Map.prototype, resolveMap);
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

  if (typeof pattern === 'function') {
    return resolveFunction(pattern);
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
    if (arities.has(args.length)) {
      const arityClauses = arities.get(args.length);

      let funcToCall = null;
      let params = null;
      for (let processedClause of arityClauses) {
        let result = [];
        args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

        const doesMatch = processedClause.pattern(args, result);
        const [filteredResult, allNamesMatch] = checkNamedVariables(result);

        if (doesMatch && allNamesMatch && (yield* processedClause.guard.apply(this, filteredResult))) {
          funcToCall = processedClause.fn;
          params = filteredResult;
          break;
        }
      }

      if (!funcToCall) {
        console.error('No match for:', args);
        throw new MatchError(args);
      }

      return yield* funcToCall.apply(this, params);
    } else {
      console.error('Arity of', args.length, 'not found. No match for:', args);
      throw new MatchError(args);
    }
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

        if (doesMatch && allNamesMatch && (await processedClause.guard.apply(this, filteredResult))) {
          funcToCall = processedClause.fn;
          params = filteredResult;
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

function* match_gen(pattern, expr, guard = function* () {
  return true;
}) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  const doesMatch = processedPattern(expr, result);
  const [filteredResult, allNamesMatch] = checkNamedVariables(result);
  const matches = doesMatch && allNamesMatch;

  if (matches && (yield* guard.apply(this, filteredResult))) {
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

function* match_or_default_gen(pattern, expr, guard = function* () {
  return true;
}, default_value = null) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  const doesMatch = processedPattern(expr, result);
  const [filteredResult, allNamesMatch] = checkNamedVariables(result);
  const matches = doesMatch && allNamesMatch;

  if (matches && (yield* guard.apply(this, filteredResult))) {
    return filteredResult;
  } else {
    return default_value;
  }
}

async function match_or_default_async(pattern, expr, guard = async () => true, default_value = null) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  const doesMatch = processedPattern(expr, result);
  const [filteredResult, allNamesMatch] = checkNamedVariables(result);
  const matches = doesMatch && allNamesMatch;

  if (matches && (await guard.apply(this, filteredResult))) {
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
  match_gen,
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
  match_or_default_gen,
  match_or_default_async,
  defmatchgen,
  list_comprehension,
  list_generator,
  bitstring_generator,
  bitstring_comprehension,
  defmatchGen,
  defmatchAsync
};

module.exports = index;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvdXRpbHMuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcbiAgY29uc3RydWN0b3IobmFtZSA9IG51bGwsIGRlZmF1bHRfdmFsdWUgPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmRlZmF1bHRfdmFsdWUgPSBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG5cbmNsYXNzIFdpbGRjYXJkIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBTdGFydHNXaXRoIHtcbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cbn1cblxuY2xhc3MgQ2FwdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoaGVhZCwgdGFpbCkge1xuICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG4gICAgdGhpcy50YWlsID0gdGFpbDtcbiAgfVxufVxuXG5jbGFzcyBUeXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgQml0U3RyaW5nTWF0Y2gge1xuICBjb25zdHJ1Y3RvciguLi52YWx1ZXMpIHtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpIHtcbiAgICBsZXQgcyA9IDA7XG5cbiAgICBmb3IgKGxldCB2YWwgb2YgdGhpcy52YWx1ZXMpIHtcbiAgICAgIHMgPSBzICsgdmFsLnVuaXQgKiB2YWwuc2l6ZSAvIDg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBnZXRWYWx1ZShpbmRleCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcyhpbmRleCk7XG4gIH1cblxuICBnZXRTaXplT2ZWYWx1ZShpbmRleCkge1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0VmFsdWUoaW5kZXgpLnR5cGU7XG4gIH1cbn1cblxuY2xhc3MgTmFtZWRWYXJpYWJsZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFyaWFibGUoXG4gIG5hbWUgPSBudWxsLFxuICBkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUobmFtZSwgZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKGhlYWQsIHRhaWwpIHtcbiAgcmV0dXJuIG5ldyBIZWFkVGFpbChoZWFkLCB0YWlsKTtcbn1cblxuZnVuY3Rpb24gdHlwZSh0eXBlLCBvYmpQYXR0ZXJuID0ge30pIHtcbiAgcmV0dXJuIG5ldyBUeXBlKHR5cGUsIG9ialBhdHRlcm4pO1xufVxuXG5mdW5jdGlvbiBib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gbmV3IEJvdW5kKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gYml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKSB7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZnVuY3Rpb24gbmFtZWRWYXJpYWJsZVJlc3VsdChuYW1lLCB2YWx1ZSkge1xuICByZXR1cm4gbmV3IE5hbWVkVmFyaWFibGVSZXN1bHQobmFtZSwgdmFsdWUpO1xufVxuXG5leHBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIFN0YXJ0c1dpdGgsXG4gIENhcHR1cmUsXG4gIEhlYWRUYWlsLFxuICBUeXBlLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaCxcbiAgTmFtZWRWYXJpYWJsZVJlc3VsdCxcbiAgbmFtZWRWYXJpYWJsZVJlc3VsdFxufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCB7XG4gIFZhcmlhYmxlLFxuICBXaWxkY2FyZCxcbiAgSGVhZFRhaWwsXG4gIENhcHR1cmUsXG4gIFR5cGUsXG4gIFN0YXJ0c1dpdGgsXG4gIEJvdW5kLFxuICBCaXRTdHJpbmdNYXRjaFxufSBmcm9tICcuL3R5cGVzJztcblxuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gJ2VybGFuZy10eXBlcyc7XG5cbmZ1bmN0aW9uIGlzX251bWJlcih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNfc3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc19ib29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn1cblxuZnVuY3Rpb24gaXNfc3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnO1xufVxuXG5mdW5jdGlvbiBpc191bmRlZmluZWQodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIGlzX29iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jztcbn1cblxuZnVuY3Rpb24gaXNfdmFyaWFibGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVmFyaWFibGU7XG59XG5cbmZ1bmN0aW9uIGlzX3dpbGRjYXJkKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFdpbGRjYXJkO1xufVxuXG5mdW5jdGlvbiBpc19oZWFkVGFpbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBIZWFkVGFpbDtcbn1cblxuZnVuY3Rpb24gaXNfY2FwdHVyZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBDYXB0dXJlO1xufVxuXG5mdW5jdGlvbiBpc190eXBlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFR5cGU7XG59XG5cbmZ1bmN0aW9uIGlzX3N0YXJ0c1dpdGgodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgU3RhcnRzV2l0aDtcbn1cblxuZnVuY3Rpb24gaXNfYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQm91bmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2JpdHN0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmdNYXRjaDtcbn1cblxuZnVuY3Rpb24gaXNfbnVsbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzX2FycmF5KHZhbHVlKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gaXNfZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyB8fCB2YWx1ZSBpbnN0YW5jZW9mIEZ1bmN0aW9uO1xufVxuXG5mdW5jdGlvbiBpc19tYXAodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgTWFwO1xufVxuXG5mdW5jdGlvbiBpc19waWQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgRXJsYW5nVHlwZXMuUElEO1xufVxuXG5mdW5jdGlvbiBpc190dXBsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBFcmxhbmdUeXBlcy5UdXBsZTtcbn1cblxuZnVuY3Rpb24gaXNfcmVmZXJlbmNlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEVybGFuZ1R5cGVzLlJlZmVyZW5jZTtcbn1cblxuZXhwb3J0IHtcbiAgaXNfbnVtYmVyLFxuICBpc19zdHJpbmcsXG4gIGlzX2Jvb2xlYW4sXG4gIGlzX3N5bWJvbCxcbiAgaXNfbnVsbCxcbiAgaXNfdW5kZWZpbmVkLFxuICBpc19mdW5jdGlvbixcbiAgaXNfdmFyaWFibGUsXG4gIGlzX3dpbGRjYXJkLFxuICBpc19oZWFkVGFpbCxcbiAgaXNfY2FwdHVyZSxcbiAgaXNfdHlwZSxcbiAgaXNfc3RhcnRzV2l0aCxcbiAgaXNfYm91bmQsXG4gIGlzX29iamVjdCxcbiAgaXNfYXJyYXksXG4gIGlzX2JpdHN0cmluZyxcbiAgaXNfbWFwLFxuICBpc190dXBsZSxcbiAgaXNfcGlkLFxuICBpc19yZWZlcmVuY2UsXG59O1xuIiwiaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gJy4vY2hlY2tzJztcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tICdlcmxhbmctdHlwZXMnO1xuXG5mdW5jdGlvbiBhcnJheUVxdWFscyhsZWZ0LCByaWdodCkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkocmlnaHQpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGxlZnQubGVuZ3RoICE9PSByaWdodC5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxlZnQubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoZXF1YWxzKGxlZnRbaV0sIHJpZ2h0W2ldKSA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gdHVwbGVFcXVhbHMobGVmdCwgcmlnaHQpIHtcbiAgaWYgKHJpZ2h0IGluc3RhbmNlb2YgRXJsYW5nVHlwZXMuVHVwbGUgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGxlZnQubGVuZ3RoICE9PSByaWdodC5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gYXJyYXlFcXVhbHMobGVmdC52YWx1ZXMsIHJpZ2h0LnZhbHVlcyk7XG59XG5cbmZ1bmN0aW9uIGJpdHN0cmluZ0VxdWFscyhsZWZ0LCByaWdodCkge1xuICBpZiAocmlnaHQgaW5zdGFuY2VvZiBFcmxhbmdUeXBlcy5CaXRTdHJpbmcgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGxlZnQubGVuZ3RoICE9PSByaWdodC5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gYXJyYXlFcXVhbHMobGVmdC52YWx1ZSwgcmlnaHQudmFsdWUpO1xufVxuXG5mdW5jdGlvbiBwaWRFcXVhbHMobGVmdCwgcmlnaHQpIHtcbiAgaWYgKHJpZ2h0IGluc3RhbmNlb2YgRXJsYW5nVHlwZXMuUElEID09PSBmYWxzZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBsZWZ0LmlkID09PSByaWdodC5pZDtcbn1cblxuZnVuY3Rpb24gcmVmZXJlbmNlRXF1YWxzKGxlZnQsIHJpZ2h0KSB7XG4gIGlmIChyaWdodCBpbnN0YW5jZW9mIEVybGFuZ1R5cGVzLlJlZmVyZW5jZSA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gbGVmdC5pZCA9PT0gcmlnaHQuaWQ7XG59XG5cbmZ1bmN0aW9uIG1hcEVxdWFscyhsZWZ0LCByaWdodCkge1xuICBpZiAocmlnaHQgaW5zdGFuY2VvZiBNYXAgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgbGVmdEVudHJpZXMgPSBBcnJheS5mcm9tKGxlZnQuZW50cmllcygpKTtcbiAgY29uc3QgcmlnaHRFbnRyaWVzID0gQXJyYXkuZnJvbShyaWdodC5lbnRyaWVzKCkpO1xuXG4gIHJldHVybiBhcnJheUVxdWFscyhsZWZ0RW50cmllcywgcmlnaHRFbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gZXF1YWxzKGxlZnQsIHJpZ2h0KSB7XG4gIGlmIChBcnJheS5pc0FycmF5KGxlZnQpKSB7XG4gICAgcmV0dXJuIGFycmF5RXF1YWxzKGxlZnQsIHJpZ2h0KTtcbiAgfVxuXG4gIGlmIChsZWZ0IGluc3RhbmNlb2YgRXJsYW5nVHlwZXMuVHVwbGUpIHtcbiAgICByZXR1cm4gdHVwbGVFcXVhbHMobGVmdCwgcmlnaHQpO1xuICB9XG5cbiAgaWYgKGxlZnQgaW5zdGFuY2VvZiBFcmxhbmdUeXBlcy5QSUQpIHtcbiAgICByZXR1cm4gcGlkRXF1YWxzKGxlZnQsIHJpZ2h0KTtcbiAgfVxuXG4gIGlmIChsZWZ0IGluc3RhbmNlb2YgRXJsYW5nVHlwZXMuQml0U3RyaW5nKSB7XG4gICAgcmV0dXJuIGJpdHN0cmluZ0VxdWFscyhsZWZ0LCByaWdodCk7XG4gIH1cblxuICBpZiAobGVmdCBpbnN0YW5jZW9mIEVybGFuZ1R5cGVzLlJlZmVyZW5jZSkge1xuICAgIHJldHVybiByZWZlcmVuY2VFcXVhbHMobGVmdCwgcmlnaHQpO1xuICB9XG5cbiAgaWYgKGxlZnQgaW5zdGFuY2VvZiBNYXApIHtcbiAgICByZXR1cm4gbWFwRXF1YWxzKGxlZnQsIHJpZ2h0KTtcbiAgfVxuXG4gIHJldHVybiBsZWZ0ID09PSByaWdodDtcbn1cblxuZnVuY3Rpb24gaXNfbm9uX3ByaW1pdGl2ZShrZXkpIHtcbiAgcmV0dXJuIChcbiAgICBDaGVja3MuaXNfYXJyYXkoa2V5KSB8fFxuICAgIENoZWNrcy5pc19tYXAoa2V5KSB8fFxuICAgIENoZWNrcy5pc19waWQoa2V5KSB8fFxuICAgIENoZWNrcy5pc19yZWZlcmVuY2Uoa2V5KSB8fFxuICAgIENoZWNrcy5pc19iaXRzdHJpbmcoa2V5KSB8fFxuICAgIENoZWNrcy5pc190dXBsZShrZXkpXG4gICk7XG59XG5cbmZ1bmN0aW9uIGhhcyhtYXAsIGtleSkge1xuICBpZiAoaXNfbm9uX3ByaW1pdGl2ZShrZXkpKSB7XG4gICAgZm9yIChjb25zdCBtYXBfa2V5IG9mIG1hcC5rZXlzKCkpIHtcbiAgICAgIGlmIChlcXVhbHMobWFwX2tleSwga2V5KSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gbWFwLmhhcyhrZXkpO1xufVxuXG5mdW5jdGlvbiBnZXQobWFwLCBrZXkpIHtcbiAgaWYgKGlzX25vbl9wcmltaXRpdmUoa2V5KSkge1xuICAgIGZvciAoY29uc3QgbWFwX2tleSBvZiBtYXAua2V5cygpKSB7XG4gICAgICBpZiAoZXF1YWxzKG1hcF9rZXksIGtleSkpIHtcbiAgICAgICAgcmV0dXJuIG1hcC5nZXQobWFwX2tleSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gbWFwLmdldChrZXkpO1xufVxuXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZ2V0LFxuICBoYXMsXG4gIGVxdWFscyxcbn1cbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCAqIGFzIENoZWNrcyBmcm9tICcuL2NoZWNrcyc7XG5pbXBvcnQgKiBhcyBUeXBlcyBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGJ1aWxkTWF0Y2ggfSBmcm9tICcuL21hdGNoJztcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tICdlcmxhbmctdHlwZXMnO1xuY29uc3QgQml0U3RyaW5nID0gRXJsYW5nVHlwZXMuQml0U3RyaW5nO1xuaW1wb3J0IFV0aWxzIGZyb20gJy4vdXRpbHMnXG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdW1iZXIocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19mdW5jdGlvbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdWxsKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChwYXR0ZXJuLm5hbWUgPT09IG51bGwpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChwYXR0ZXJuLm5hbWUgIT09ICdfJykge1xuICAgICAgYXJncy5wdXNoKFR5cGVzLm5hbWVkVmFyaWFibGVSZXN1bHQocGF0dGVybi5uYW1lLCB2YWx1ZSkpO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSGVhZFRhaWwocGF0dGVybikge1xuICBjb25zdCBoZWFkTWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi5oZWFkKTtcbiAgY29uc3QgdGFpbE1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udGFpbCk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IGhlYWQgPSB2YWx1ZVswXTtcbiAgICBjb25zdCB0YWlsID0gdmFsdWUuc2xpY2UoMSk7XG5cbiAgICBpZiAoaGVhZE1hdGNoZXMoaGVhZCwgYXJncykgJiYgdGFpbE1hdGNoZXModGFpbCwgYXJncykpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUNhcHR1cmUocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLnZhbHVlKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAobWF0Y2hlcyh2YWx1ZSwgYXJncykpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdGFydHNXaXRoKHBhdHRlcm4pIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmIHZhbHVlLnN0YXJ0c1dpdGgocHJlZml4KSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVUeXBlKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybi50eXBlKSB7XG4gICAgICBjb25zdCBtYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLm9ialBhdHRlcm4pO1xuICAgICAgcmV0dXJuIG1hdGNoZXModmFsdWUsIGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUFycmF5KHBhdHRlcm4pIHtcbiAgY29uc3QgbWF0Y2hlcyA9IHBhdHRlcm4ubWFwKHggPT4gYnVpbGRNYXRjaCh4KSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCAhPSBwYXR0ZXJuLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZS5ldmVyeShmdW5jdGlvbih2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVNYXAocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IG5ldyBNYXAoKTtcblxuICBjb25zdCBrZXlzID0gQXJyYXkuZnJvbShwYXR0ZXJuLmtleXMoKSk7XG5cbiAgZm9yIChsZXQga2V5IG9mIGtleXMpIHtcbiAgICBtYXRjaGVzLnNldChrZXksIGJ1aWxkTWF0Y2gocGF0dGVybi5nZXQoa2V5KSkpO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfbWFwKHZhbHVlKSB8fCBwYXR0ZXJuLnNpemUgPiB2YWx1ZS5zaXplKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCFVdGlscy5oYXModmFsdWUsIGtleSkgfHwgIVV0aWxzLmdldChtYXRjaGVzLCBrZXkpKFV0aWxzLmdldCh2YWx1ZSwga2V5KSwgYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlT2JqZWN0KHBhdHRlcm4pIHtcbiAgbGV0IG1hdGNoZXMgPSB7fTtcblxuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocGF0dGVybikuY29uY2F0KFxuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocGF0dGVybilcbiAgKTtcblxuICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgIG1hdGNoZXNba2V5XSA9IGJ1aWxkTWF0Y2gocGF0dGVybltrZXldKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX29iamVjdCh2YWx1ZSkgfHwgcGF0dGVybi5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCEoa2V5IGluIHZhbHVlKSB8fCAhbWF0Y2hlc1trZXldKHZhbHVlW2tleV0sIGFyZ3MpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJpdFN0cmluZyhwYXR0ZXJuKSB7XG4gIGxldCBwYXR0ZXJuQml0U3RyaW5nID0gW107XG5cbiAgZm9yIChsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0IG9mIHBhdHRlcm4udmFsdWVzKSB7XG4gICAgaWYgKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpKSB7XG4gICAgICBsZXQgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcbiAgICAgIGZpbGxBcnJheShwYXR0ZXJuQml0U3RyaW5nLCBzaXplKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGF0dGVybkJpdFN0cmluZyA9IHBhdHRlcm5CaXRTdHJpbmcuY29uY2F0KFxuICAgICAgICBuZXcgQml0U3RyaW5nKGJpdHN0cmluZ01hdGNoUGFydCkudmFsdWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHBhdHRlcm5WYWx1ZXMgPSBwYXR0ZXJuLnZhbHVlcztcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBsZXQgYnNWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoIUNoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKSB7XG4gICAgICBic1ZhbHVlID0gbmV3IEJpdFN0cmluZyhCaXRTdHJpbmcuYmluYXJ5KHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0ID0gcGF0dGVyblZhbHVlc1tpXTtcblxuICAgICAgaWYgKFxuICAgICAgICBDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgIGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDFcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ2EgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuJ1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmIChpID09PSBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShiZWdpbm5pbmdJbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBic1ZhbHVlQXJyYXlQYXJ0ID0gYnNWYWx1ZS52YWx1ZS5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemVcbiAgICAgICAgKTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXgsXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXggKyBzaXplXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSkge1xuICAgICAgICBzd2l0Y2ggKGJpdHN0cmluZ01hdGNoUGFydC50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzICYmXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzLmluZGV4T2YoJ3NpZ25lZCcpICE9IC0xXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBJbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIGlmIChzaXplID09PSA2NCkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzaXplID09PSAzMikge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgICAgYXJncy5wdXNoKGNyZWF0ZUJpdFN0cmluZyhic1ZhbHVlQXJyYXlQYXJ0KSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghYXJyYXlzRXF1YWwoYnNWYWx1ZUFycmF5UGFydCwgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBiZWdpbm5pbmdJbmRleCA9IGJlZ2lubmluZ0luZGV4ICsgc2l6ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2l6ZSh1bml0LCBzaXplKSB7XG4gIHJldHVybiB1bml0ICogc2l6ZSAvIDg7XG59XG5cbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoYS5sZW5ndGggIT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxBcnJheShhcnIsIG51bSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgYXJyLnB1c2goMCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQml0U3RyaW5nKGFycikge1xuICBsZXQgaW50ZWdlclBhcnRzID0gYXJyLm1hcChlbGVtID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmcsXG4gIHJlc29sdmVNYXBcbn07XG4iLCJpbXBvcnQgKiBhcyBSZXNvbHZlcnMgZnJvbSAnLi9yZXNvbHZlcnMnO1xuaW1wb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBIZWFkVGFpbCxcbiAgQ2FwdHVyZSxcbiAgVHlwZSxcbiAgU3RhcnRzV2l0aCxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoXG59IGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBwYXR0ZXJuTWFwID0gbmV3IE1hcCgpO1xucGF0dGVybk1hcC5zZXQoVmFyaWFibGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVZhcmlhYmxlKTtcbnBhdHRlcm5NYXAuc2V0KFdpbGRjYXJkLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZCk7XG5wYXR0ZXJuTWFwLnNldChIZWFkVGFpbC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwpO1xucGF0dGVybk1hcC5zZXQoU3RhcnRzV2l0aC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aCk7XG5wYXR0ZXJuTWFwLnNldChDYXB0dXJlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKTtcbnBhdHRlcm5NYXAuc2V0KEJvdW5kLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCb3VuZCk7XG5wYXR0ZXJuTWFwLnNldChUeXBlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVUeXBlKTtcbnBhdHRlcm5NYXAuc2V0KEJpdFN0cmluZ01hdGNoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoTnVtYmVyLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVOdW1iZXIpO1xucGF0dGVybk1hcC5zZXQoU3ltYm9sLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTeW1ib2wpO1xucGF0dGVybk1hcC5zZXQoTWFwLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVNYXApO1xucGF0dGVybk1hcC5zZXQoQXJyYXkucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUFycmF5KTtcbnBhdHRlcm5NYXAuc2V0KFN0cmluZy5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RyaW5nKTtcbnBhdHRlcm5NYXAuc2V0KEJvb2xlYW4ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvb2xlYW4pO1xucGF0dGVybk1hcC5zZXQoRnVuY3Rpb24ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUZ1bmN0aW9uKTtcbnBhdHRlcm5NYXAuc2V0KE9iamVjdC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlT2JqZWN0KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkTWF0Y2gocGF0dGVybikge1xuICBpZiAocGF0dGVybiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVGdW5jdGlvbihwYXR0ZXJuKTtcbiAgfVxuXG4gIGNvbnN0IHR5cGUgPSBwYXR0ZXJuLmNvbnN0cnVjdG9yLnByb3RvdHlwZTtcbiAgY29uc3QgcmVzb2x2ZXIgPSBwYXR0ZXJuTWFwLmdldCh0eXBlKTtcblxuICBpZiAocmVzb2x2ZXIpIHtcbiAgICByZXR1cm4gcmVzb2x2ZXIocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlT2JqZWN0KHBhdHRlcm4pO1xuICB9XG5cbiAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlTm9NYXRjaCgpO1xufVxuIiwiaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi90eXBlcyc7XG5cbmNvbnN0IEZVTkMgPSBTeW1ib2woKTtcblxuZXhwb3J0IGNsYXNzIE1hdGNoRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGFyZykge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcpIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBhcmcudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICAgbGV0IG1hcHBlZFZhbHVlcyA9IGFyZy5tYXAoeCA9PiB7XG4gICAgICAgIGlmICh4ID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuICdudWxsJztcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgeCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geC50b1N0cmluZygpO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBtYXBwZWRWYWx1ZXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBhcmc7XG4gICAgfVxuXG4gICAgdGhpcy5uYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGF1c2Uge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgICB0aGlzLmFyaXR5ID0gcGF0dGVybi5sZW5ndGg7XG4gICAgdGhpcy5vcHRpb25hbHMgPSBnZXRPcHRpb25hbFZhbHVlcyhwYXR0ZXJuKTtcbiAgICB0aGlzLmZuID0gZm47XG4gICAgdGhpcy5ndWFyZCA9IGd1YXJkO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGF1c2UocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICByZXR1cm4gbmV3IENsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbXBvbGluZShmbikge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJlcyA9IGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgd2hpbGUgKHJlcyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXMgPSByZXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoZ2VuKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBmdW5jdGlvbiooLi4uYXJncykge1xuICAgIGlmIChhcml0aWVzLmhhcyhhcmdzLmxlbmd0aCkpIHtcbiAgICAgIGNvbnN0IGFyaXR5Q2xhdXNlcyA9IGFyaXRpZXMuZ2V0KGFyZ3MubGVuZ3RoKTtcblxuICAgICAgbGV0IGZ1bmNUb0NhbGwgPSBudWxsO1xuICAgICAgbGV0IHBhcmFtcyA9IG51bGw7XG4gICAgICBmb3IgKGxldCBwcm9jZXNzZWRDbGF1c2Ugb2YgYXJpdHlDbGF1c2VzKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgICAgYXJncyA9IGZpbGxJbk9wdGlvbmFsVmFsdWVzKFxuICAgICAgICAgIGFyZ3MsXG4gICAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmFyaXR5LFxuICAgICAgICAgIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHNcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpO1xuICAgICAgICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICBkb2VzTWF0Y2ggJiZcbiAgICAgICAgICBhbGxOYW1lc01hdGNoICYmXG4gICAgICAgICAgKHlpZWxkKiBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpKVxuICAgICAgICApIHtcbiAgICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICAgIHBhcmFtcyA9IGZpbHRlcmVkUmVzdWx0O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4geWllbGQqIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignQXJpdHkgb2YnLCBhcmdzLmxlbmd0aCwgJ25vdCBmb3VuZC4gTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hHZW4oLi4uYXJncykge1xuICByZXR1cm4gZGVmbWF0Y2hnZW4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEFzeW5jKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBhc3luYyBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgaWYgKGFyaXRpZXMuaGFzKGFyZ3MubGVuZ3RoKSkge1xuICAgICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgICAgYXJncyxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFsc1xuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGRvZXNNYXRjaCA9IHByb2Nlc3NlZENsYXVzZS5wYXR0ZXJuKGFyZ3MsIHJlc3VsdCk7XG4gICAgICAgIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIGRvZXNNYXRjaCAmJlxuICAgICAgICAgIGFsbE5hbWVzTWF0Y2ggJiZcbiAgICAgICAgICAoYXdhaXQgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgICBwYXJhbXMgPSBmaWx0ZXJlZFJlc3VsdDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIWZ1bmNUb0NhbGwpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignQXJpdHkgb2YnLCBhcmdzLmxlbmd0aCwgJ25vdCBmb3VuZC4gTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKSB7XG4gIGlmIChhcml0aWVzLmhhcyhhcmdzLmxlbmd0aCkpIHtcbiAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgbGV0IHBhcmFtcyA9IG51bGw7XG4gICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgYXJncyA9IGZpbGxJbk9wdGlvbmFsVmFsdWVzKFxuICAgICAgICBhcmdzLFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHNcbiAgICAgICk7XG5cbiAgICAgIGNvbnN0IGRvZXNNYXRjaCA9IHByb2Nlc3NlZENsYXVzZS5wYXR0ZXJuKGFyZ3MsIHJlc3VsdCk7XG4gICAgICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuXG4gICAgICBpZiAoXG4gICAgICAgIGRvZXNNYXRjaCAmJlxuICAgICAgICBhbGxOYW1lc01hdGNoICYmXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5ndWFyZC5hcHBseSh0aGlzLCBmaWx0ZXJlZFJlc3VsdClcbiAgICAgICkge1xuICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICBwYXJhbXMgPSBmaWx0ZXJlZFJlc3VsdDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gW2Z1bmNUb0NhbGwsIHBhcmFtc107XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignQXJpdHkgb2YnLCBhcmdzLmxlbmd0aCwgJ25vdCBmb3VuZC4gTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEFyaXR5TWFwKGNsYXVzZXMpIHtcbiAgbGV0IG1hcCA9IG5ldyBNYXAoKTtcblxuICBmb3IgKGNvbnN0IGNsYXVzZSBvZiBjbGF1c2VzKSB7XG4gICAgY29uc3QgcmFuZ2UgPSBnZXRBcml0eVJhbmdlKGNsYXVzZSk7XG5cbiAgICBmb3IgKGNvbnN0IGFyaXR5IG9mIHJhbmdlKSB7XG4gICAgICBsZXQgYXJpdHlDbGF1c2VzID0gW107XG5cbiAgICAgIGlmIChtYXAuaGFzKGFyaXR5KSkge1xuICAgICAgICBhcml0eUNsYXVzZXMgPSBtYXAuZ2V0KGFyaXR5KTtcbiAgICAgIH1cblxuICAgICAgYXJpdHlDbGF1c2VzLnB1c2goY2xhdXNlKTtcbiAgICAgIG1hcC5zZXQoYXJpdHksIGFyaXR5Q2xhdXNlcyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG1hcDtcbn1cblxuZnVuY3Rpb24gZ2V0QXJpdHlSYW5nZShjbGF1c2UpIHtcbiAgY29uc3QgbWluID0gY2xhdXNlLmFyaXR5IC0gY2xhdXNlLm9wdGlvbmFscy5sZW5ndGg7XG4gIGNvbnN0IG1heCA9IGNsYXVzZS5hcml0eTtcblxuICBsZXQgcmFuZ2UgPSBbbWluXTtcblxuICB3aGlsZSAocmFuZ2VbcmFuZ2UubGVuZ3RoIC0gMV0gIT0gbWF4KSB7XG4gICAgcmFuZ2UucHVzaChyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSArIDEpO1xuICB9XG5cbiAgcmV0dXJuIHJhbmdlO1xufVxuXG5mdW5jdGlvbiBnZXRPcHRpb25hbFZhbHVlcyhwYXR0ZXJuKSB7XG4gIGxldCBvcHRpb25hbHMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm4ubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoXG4gICAgICBwYXR0ZXJuW2ldIGluc3RhbmNlb2YgVHlwZXMuVmFyaWFibGUgJiZcbiAgICAgIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZSAhPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpXG4gICAgKSB7XG4gICAgICBvcHRpb25hbHMucHVzaChbaSwgcGF0dGVybltpXS5kZWZhdWx0X3ZhbHVlXSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9wdGlvbmFscztcbn1cblxuZnVuY3Rpb24gZmlsbEluT3B0aW9uYWxWYWx1ZXMoYXJncywgYXJpdHksIG9wdGlvbmFscykge1xuICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5IHx8IG9wdGlvbmFscy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGlmIChhcmdzLmxlbmd0aCArIG9wdGlvbmFscy5sZW5ndGggPCBhcml0eSkge1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgbGV0IG51bWJlck9mT3B0aW9uYWxzVG9GaWxsID0gYXJpdHkgLSBhcmdzLmxlbmd0aDtcbiAgbGV0IG9wdGlvbmFsc1RvUmVtb3ZlID0gb3B0aW9uYWxzLmxlbmd0aCAtIG51bWJlck9mT3B0aW9uYWxzVG9GaWxsO1xuXG4gIGxldCBvcHRpb25hbHNUb1VzZSA9IG9wdGlvbmFscy5zbGljZShvcHRpb25hbHNUb1JlbW92ZSk7XG5cbiAgZm9yIChsZXQgW2luZGV4LCB2YWx1ZV0gb2Ygb3B0aW9uYWxzVG9Vc2UpIHtcbiAgICBhcmdzLnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gYXJpdHkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhcmdzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2gocGF0dGVybiwgZXhwciwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCk7XG4gIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgaWYgKGRvZXNNYXRjaCAmJiBhbGxOYW1lc01hdGNoICYmIGd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSkge1xuICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgZXhwcik7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoZXhwcik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uKiBtYXRjaF9nZW4oXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gZnVuY3Rpb24qICgpIHsgcmV0dXJuIHRydWUgfVxuKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCk7XG4gIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG4gIGNvbnN0IG1hdGNoZXMgPSBkb2VzTWF0Y2ggJiYgYWxsTmFtZXNNYXRjaDtcblxuICBpZiAobWF0Y2hlcyAmJiAoeWllbGQqIGd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGV4cHIpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGV4cHIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0cykge1xuICBjb25zdCBuYW1lc01hcCA9IHt9O1xuICBjb25zdCBmaWx0ZXJlZFJlc3VsdHMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjdXJyZW50ID0gcmVzdWx0c1tpXTtcbiAgICBpZiAoY3VycmVudCBpbnN0YW5jZW9mIFR5cGVzLk5hbWVkVmFyaWFibGVSZXN1bHQpIHtcbiAgICAgIGlmIChuYW1lc01hcFtjdXJyZW50Lm5hbWVdICYmIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gIT09IGN1cnJlbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIFtyZXN1bHRzLCBmYWxzZV07XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdICYmXG4gICAgICAgIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gPT09IGN1cnJlbnQudmFsdWVcbiAgICAgICkge1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChjdXJyZW50LnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gPSBjdXJyZW50LnZhbHVlO1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChjdXJyZW50LnZhbHVlKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFtmaWx0ZXJlZFJlc3VsdHMsIHRydWVdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hfb3JfZGVmYXVsdChcbiAgcGF0dGVybixcbiAgZXhwcixcbiAgZ3VhcmQgPSAoKSA9PiB0cnVlLFxuICBkZWZhdWx0X3ZhbHVlID0gbnVsbFxuKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCk7XG4gIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgaWYgKGRvZXNNYXRjaCAmJiBhbGxOYW1lc01hdGNoICYmIGd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSkge1xuICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24qIG1hdGNoX29yX2RlZmF1bHRfZ2VuKFxuICBwYXR0ZXJuLFxuICBleHByLFxuICBndWFyZCA9IGZ1bmN0aW9uKiAoKSB7IHJldHVybiB0cnVlIH0sXG4gIGRlZmF1bHRfdmFsdWUgPSBudWxsXG4pIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGNvbnN0IGRvZXNNYXRjaCA9IHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KTtcbiAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcbiAgY29uc3QgbWF0Y2hlcyA9IGRvZXNNYXRjaCAmJiBhbGxOYW1lc01hdGNoO1xuXG4gIGlmIChtYXRjaGVzICYmICh5aWVsZCogZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpKSkge1xuICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWF0Y2hfb3JfZGVmYXVsdF9hc3luYyhcbiAgcGF0dGVybixcbiAgZXhwcixcbiAgZ3VhcmQgPSBhc3luYyAoKSA9PiB0cnVlLFxuICBkZWZhdWx0X3ZhbHVlID0gbnVsbFxuKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCk7XG4gIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG4gIGNvbnN0IG1hdGNoZXMgPSBkb2VzTWF0Y2ggJiYgYWxsTmFtZXNNYXRjaDtcblxuICBpZiAobWF0Y2hlcyAmJiAoYXdhaXQgZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpKSkge1xuICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgbWF0Y2hfb3JfZGVmYXVsdCB9IGZyb20gXCIuL2RlZm1hdGNoXCI7XG5pbXBvcnQgRXJsYW5nVHlwZXMgZnJvbSBcImVybGFuZy10eXBlc1wiO1xuXG5jb25zdCBOT19NQVRDSCA9IFN5bWJvbCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2dlbmVyYXRvcihwYXR0ZXJuLCBiaXRzdHJpbmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBsZXQgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZSgwLCBwYXR0ZXJuLmJ5dGVfc2l6ZSgpKTtcbiAgICBsZXQgaSA9IDE7XG5cbiAgICB3aGlsZSAoYnNTbGljZS5ieXRlX3NpemUgPT0gcGF0dGVybi5ieXRlX3NpemUoKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBic1NsaWNlLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG5cbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2gocmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZShcbiAgICAgICAgcGF0dGVybi5ieXRlX3NpemUoKSAqIGksXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiAoaSArIDEpXG4gICAgICApO1xuXG4gICAgICBpKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfZ2VuZXJhdG9yKHBhdHRlcm4sIGxpc3QpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBmb3IgKGxldCBpIG9mIGxpc3QpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgaSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuICAgICAgaWYgKHJlc3VsdCAhPSBOT19NQVRDSCkge1xuICAgICAgICBjb25zdCBbdmFsdWVdID0gcmVzdWx0O1xuICAgICAgICByZXR1cm5SZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfY29tcHJlaGVuc2lvbihleHByZXNzaW9uLCBnZW5lcmF0b3JzKSB7XG4gIGNvbnN0IGdlbmVyYXRlZFZhbHVlcyA9IHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvcnMucG9wKCkoKSwgZ2VuZXJhdG9ycyk7XG5cbiAgbGV0IHJlc3VsdCA9IFtdO1xuXG4gIGZvciAobGV0IHZhbHVlIG9mIGdlbmVyYXRlZFZhbHVlcykge1xuICAgIGlmIChleHByZXNzaW9uLmd1YXJkLmFwcGx5KHRoaXMsIHZhbHVlKSkge1xuICAgICAgcmVzdWx0LnB1c2goZXhwcmVzc2lvbi5mbi5hcHBseSh0aGlzLCB2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvciwgZ2VuZXJhdG9ycykge1xuICBpZiAoZ2VuZXJhdG9ycy5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBnZW5lcmF0b3IubWFwKHggPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoeCkpIHtcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW3hdO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGxpc3QgPSBnZW5lcmF0b3JzLnBvcCgpO1xuXG4gICAgbGV0IG5leHRfZ2VuID0gW107XG4gICAgZm9yIChsZXQgaiBvZiBsaXN0KCkpIHtcbiAgICAgIGZvciAobGV0IGkgb2YgZ2VuZXJhdG9yKSB7XG4gICAgICAgIG5leHRfZ2VuLnB1c2goW2pdLmNvbmNhdChpKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJ1bl9nZW5lcmF0b3JzKG5leHRfZ2VuLCBnZW5lcmF0b3JzKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXN1bHQgPSByZXN1bHQubWFwKHggPT4gRXJsYW5nVHlwZXMuQml0U3RyaW5nLmludGVnZXIoeCkpO1xuICByZXR1cm4gbmV3IEVybGFuZ1R5cGVzLkJpdFN0cmluZyguLi5yZXN1bHQpO1xufVxuIiwiaW1wb3J0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBtYXRjaF9nZW4sXG4gIE1hdGNoRXJyb3IsXG4gIENsYXVzZSxcbiAgY2xhdXNlLFxuICBtYXRjaF9vcl9kZWZhdWx0LFxuICBtYXRjaF9vcl9kZWZhdWx0X2dlbixcbiAgbWF0Y2hfb3JfZGVmYXVsdF9hc3luYyxcbiAgZGVmbWF0Y2hnZW4sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jXG59IGZyb20gJy4vdGFpbG9yZWQvZGVmbWF0Y2gnO1xuaW1wb3J0IHtcbiAgdmFyaWFibGUsXG4gIHdpbGRjYXJkLFxuICBzdGFydHNXaXRoLFxuICBjYXB0dXJlLFxuICBoZWFkVGFpbCxcbiAgdHlwZSxcbiAgYm91bmQsXG4gIGJpdFN0cmluZ01hdGNoXG59IGZyb20gJy4vdGFpbG9yZWQvdHlwZXMnO1xuXG5pbXBvcnQge1xuICBsaXN0X2dlbmVyYXRvcixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvblxufSBmcm9tICcuL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zJztcblxuZXhwb3J0IGRlZmF1bHQge1xuICBkZWZtYXRjaCxcbiAgbWF0Y2gsXG4gIG1hdGNoX2dlbixcbiAgTWF0Y2hFcnJvcixcbiAgdmFyaWFibGUsXG4gIHdpbGRjYXJkLFxuICBzdGFydHNXaXRoLFxuICBjYXB0dXJlLFxuICBoZWFkVGFpbCxcbiAgdHlwZSxcbiAgYm91bmQsXG4gIENsYXVzZSxcbiAgY2xhdXNlLFxuICBiaXRTdHJpbmdNYXRjaCxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgbWF0Y2hfb3JfZGVmYXVsdF9nZW4sXG4gIG1hdGNoX29yX2RlZmF1bHRfYXN5bmMsXG4gIGRlZm1hdGNoZ2VuLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbiAgZGVmbWF0Y2hHZW4sXG4gIGRlZm1hdGNoQXN5bmNcbn07XG4iXSwibmFtZXMiOlsiVmFyaWFibGUiLCJuYW1lIiwiZGVmYXVsdF92YWx1ZSIsIlN5bWJvbCIsImZvciIsIldpbGRjYXJkIiwiU3RhcnRzV2l0aCIsInByZWZpeCIsIkNhcHR1cmUiLCJ2YWx1ZSIsIkhlYWRUYWlsIiwiaGVhZCIsInRhaWwiLCJUeXBlIiwidHlwZSIsIm9ialBhdHRlcm4iLCJCb3VuZCIsIkJpdFN0cmluZ01hdGNoIiwidmFsdWVzIiwibGVuZ3RoIiwiYnl0ZV9zaXplIiwicyIsInZhbCIsInVuaXQiLCJzaXplIiwiaW5kZXgiLCJnZXRWYWx1ZSIsIk5hbWVkVmFyaWFibGVSZXN1bHQiLCJ2YXJpYWJsZSIsIndpbGRjYXJkIiwic3RhcnRzV2l0aCIsImNhcHR1cmUiLCJoZWFkVGFpbCIsImJvdW5kIiwiYml0U3RyaW5nTWF0Y2giLCJuYW1lZFZhcmlhYmxlUmVzdWx0IiwiaXNfbnVtYmVyIiwiaXNfc3RyaW5nIiwiaXNfYm9vbGVhbiIsImlzX3N5bWJvbCIsImlzX29iamVjdCIsImlzX3ZhcmlhYmxlIiwiaXNfYml0c3RyaW5nIiwiaXNfbnVsbCIsImlzX2FycmF5IiwiQXJyYXkiLCJpc0FycmF5IiwiaXNfZnVuY3Rpb24iLCJGdW5jdGlvbiIsImlzX21hcCIsIk1hcCIsImlzX3BpZCIsIkVybGFuZ1R5cGVzIiwiUElEIiwiaXNfdHVwbGUiLCJUdXBsZSIsImlzX3JlZmVyZW5jZSIsIlJlZmVyZW5jZSIsImFycmF5RXF1YWxzIiwibGVmdCIsInJpZ2h0IiwiaSIsImVxdWFscyIsInR1cGxlRXF1YWxzIiwiYml0c3RyaW5nRXF1YWxzIiwiQml0U3RyaW5nIiwicGlkRXF1YWxzIiwiaWQiLCJyZWZlcmVuY2VFcXVhbHMiLCJtYXBFcXVhbHMiLCJsZWZ0RW50cmllcyIsImZyb20iLCJlbnRyaWVzIiwicmlnaHRFbnRyaWVzIiwiaXNfbm9uX3ByaW1pdGl2ZSIsImtleSIsIkNoZWNrcyIsImhhcyIsIm1hcCIsIm1hcF9rZXkiLCJrZXlzIiwiZ2V0IiwicmVzb2x2ZVN5bWJvbCIsInBhdHRlcm4iLCJyZXNvbHZlU3RyaW5nIiwicmVzb2x2ZU51bWJlciIsInJlc29sdmVCb29sZWFuIiwicmVzb2x2ZUZ1bmN0aW9uIiwicmVzb2x2ZU51bGwiLCJyZXNvbHZlQm91bmQiLCJhcmdzIiwicmVzb2x2ZVdpbGRjYXJkIiwicmVzb2x2ZVZhcmlhYmxlIiwicHVzaCIsIlR5cGVzIiwicmVzb2x2ZUhlYWRUYWlsIiwiaGVhZE1hdGNoZXMiLCJidWlsZE1hdGNoIiwidGFpbE1hdGNoZXMiLCJzbGljZSIsInJlc29sdmVDYXB0dXJlIiwibWF0Y2hlcyIsInJlc29sdmVTdGFydHNXaXRoIiwic3Vic3RyaW5nIiwicmVzb2x2ZVR5cGUiLCJyZXNvbHZlQXJyYXkiLCJ4IiwiZXZlcnkiLCJ2IiwicmVzb2x2ZU1hcCIsInNldCIsIlV0aWxzIiwicmVzb2x2ZU9iamVjdCIsIk9iamVjdCIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiRmxvYXQzMkFycmF5IiwiY3JlYXRlQml0U3RyaW5nIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiYXBwbHkiLCJVaW50MTZBcnJheSIsIlVpbnQzMkFycmF5IiwiYXJyYXlzRXF1YWwiLCJhIiwiYiIsImZpbGxBcnJheSIsImFyciIsIm51bSIsImludGVnZXJQYXJ0cyIsImVsZW0iLCJpbnRlZ2VyIiwicmVzb2x2ZU5vTWF0Y2giLCJwYXR0ZXJuTWFwIiwicHJvdG90eXBlIiwiUmVzb2x2ZXJzIiwiTnVtYmVyIiwiQm9vbGVhbiIsImNvbnN0cnVjdG9yIiwicmVzb2x2ZXIiLCJNYXRjaEVycm9yIiwiYXJnIiwibWVzc2FnZSIsInRvU3RyaW5nIiwibWFwcGVkVmFsdWVzIiwiQ2xhdXNlIiwiZm4iLCJndWFyZCIsImFyaXR5Iiwib3B0aW9uYWxzIiwiZ2V0T3B0aW9uYWxWYWx1ZXMiLCJjbGF1c2UiLCJkZWZtYXRjaCIsImNsYXVzZXMiLCJhcml0aWVzIiwiZ2V0QXJpdHlNYXAiLCJmdW5jVG9DYWxsIiwicGFyYW1zIiwiZmluZE1hdGNoaW5nRnVuY3Rpb24iLCJkZWZtYXRjaGdlbiIsImFyaXR5Q2xhdXNlcyIsInByb2Nlc3NlZENsYXVzZSIsInJlc3VsdCIsImZpbGxJbk9wdGlvbmFsVmFsdWVzIiwiZG9lc01hdGNoIiwiZmlsdGVyZWRSZXN1bHQiLCJhbGxOYW1lc01hdGNoIiwiY2hlY2tOYW1lZFZhcmlhYmxlcyIsImVycm9yIiwiZGVmbWF0Y2hHZW4iLCJkZWZtYXRjaEFzeW5jIiwicmFuZ2UiLCJnZXRBcml0eVJhbmdlIiwibWluIiwibWF4IiwibnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwiLCJvcHRpb25hbHNUb1JlbW92ZSIsIm9wdGlvbmFsc1RvVXNlIiwic3BsaWNlIiwibWF0Y2giLCJleHByIiwicHJvY2Vzc2VkUGF0dGVybiIsIm1hdGNoX2dlbiIsInJlc3VsdHMiLCJuYW1lc01hcCIsImZpbHRlcmVkUmVzdWx0cyIsImN1cnJlbnQiLCJtYXRjaF9vcl9kZWZhdWx0IiwibWF0Y2hfb3JfZGVmYXVsdF9nZW4iLCJtYXRjaF9vcl9kZWZhdWx0X2FzeW5jIiwiTk9fTUFUQ0giLCJiaXRzdHJpbmdfZ2VuZXJhdG9yIiwiYml0c3RyaW5nIiwicmV0dXJuUmVzdWx0IiwiYnNTbGljZSIsImxpc3RfZ2VuZXJhdG9yIiwibGlzdCIsImxpc3RfY29tcHJlaGVuc2lvbiIsImV4cHJlc3Npb24iLCJnZW5lcmF0b3JzIiwiZ2VuZXJhdGVkVmFsdWVzIiwicnVuX2dlbmVyYXRvcnMiLCJwb3AiLCJnZW5lcmF0b3IiLCJuZXh0X2dlbiIsImoiLCJiaXRzdHJpbmdfY29tcHJlaGVuc2lvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7O0FBRUEsTUFBTUEsUUFBTixDQUFlO2NBQ0RDLE9BQU8sSUFBbkIsRUFBeUJDLGdCQUFnQkMsT0FBT0MsR0FBUCxDQUFXLG1CQUFYLENBQXpDLEVBQTBFO1NBQ25FSCxJQUFMLEdBQVlBLElBQVo7U0FDS0MsYUFBTCxHQUFxQkEsYUFBckI7Ozs7QUFJSixNQUFNRyxRQUFOLENBQWU7Z0JB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
