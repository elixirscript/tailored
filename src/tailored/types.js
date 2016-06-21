/* @flow */

class Variable {
  constructor(name = null) {
    this.name = name;
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

function variable(name = null) {
  return new Variable(name);
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

export {
  Variable,
  Wildcard,
  StartsWith,
  Capture,
  HeadTail,
  Type,
  Bound,
  variable,
  wildcard,
  startsWith,
  capture,
  headTail,
  type,
  bound
};
