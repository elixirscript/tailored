/* @flow */

class Variable {
  name: ?string;

  constructor(name: ?string = null) {
    this.name = name;
  }
}

class Wildcard {
  constructor() {
  }
}

class StartsWith {
  prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }
}

class Capture {
  value: any;

  constructor(value: any) {
    this.value = value;
  }
}

class HeadTail {
  constructor() {
  }
}

class Type {
  type: any;
  objPattern: Object;

  constructor(type: any, objPattern: Object = {}) {
    this.type = type;
    this.objPattern = objPattern;
  }
}

class Bound {
  value: any;

  constructor(value: any) {
    this.value = value;
  }
}

function variable(name: ?string = null): Variable {
  return new Variable(name);
}

function wildcard(): Wildcard {
  return new Wildcard();
}

function startsWith(prefix: string): StartsWith {
  return new StartsWith(prefix);
}

function capture(value: any): Capture {
  return new Capture(value);
}

function headTail(): HeadTail {
  return new HeadTail();
}

function type(type: any, objPattern: Object = {}): Type {
  return new Type(type, objPattern);
}

function bound(value: any): Bound {
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
