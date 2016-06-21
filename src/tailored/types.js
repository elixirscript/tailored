/* @flow */

class Variable {

  constructor(default_value = Symbol.for("tailored.no_value")) {
    this.default_value = default_value;
  }
}

class Wildcard {
  constructor() {
  }
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
  constructor() {
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

  constructor(...values){
    this.values = values;
  }

  length() {
    return values.length;
  }

  bit_size() {
    return this.byte_size() * 8;
  }

  byte_size(){
    let s = 0;

    for(let val of this.values){
      s = s + ((val.unit * val.size)/8);
    }

    return s;
  }

  getValue(index){
    return this.values(index);
  }

  getSizeOfValue(index){
    let val = this.getValue(index);
    return val.unit * val.size;
  }

  getTypeOfValue(index){
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

function bitStringMatch(...values){
  return new BitStringMatch(...values);
}

export {
  Variable,
  Wildcard,
  StartsWith,
  Capture,
  HeadTail,
  Type,
  Bound,
  BitStringMatch,
  variable,
  wildcard,
  startsWith,
  capture,
  headTail,
  type,
  bound,
  bitStringMatch
};
