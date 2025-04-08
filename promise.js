const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

const resolvePromise = (promise2, x, resolve, reject) => {
  // 如果 promise 和 x 指向同一对象，则拒绝 promise ，并以 TypeError 为理由。
  // 这里直接抛错, queueMicroHandler中catch了
  if (x === promise2) {
    throw TypeError("Chaining cycle");
  }

  if ((typeof x === "object" && x !== null) || typeof x === "function") {
    // 如果x, 即then的处理函数的返回值是一个对象或函数
    try {
      let called = false;
      let then = x.then;
      if (typeof then === "function") {
        try {
          then.call(
            x,
            (y) => {
              if (!called) {
                called = true;
                // resolve(y);  注意!!!  这里要递归调用, 处理 x 为嵌套thenable的情况
                resolvePromise(promise2, y, resolve, reject);
              }
            },
            (r) => {
              if (!called) {
                called = true;
                reject(r);
              }
            }
          );
        } catch (err) {
          if (!called) {
            reject(err);
          }
        }
      } else {
        resolve(x);
      }
    } catch (err) {
      reject(err);
    }
  } else {
    // 如果x, 即then的处理函数的返回值是一个普通值
    resolve(x);
  }
};

class MyPromise {
  constructor(executor) {
    this.status = PENDING; // 初始化状态为pending

    this.value = undefined; // 初始化兑现值
    this.reason = undefined; // 初始化失败原因

    this.onFulfilledCbs = []; // 异步执行resolve是,收集的onFulfilledCbs,等resolve执行后一并处理
    this.onRejectedCbs = []; // 异步执行reject是,收集的onRejectedCbs,等reject执行后一并处理

    const resolve = (value) => {
      // 状态改变后就不可以更改了
      if (this.status === PENDING) {
        this.status = FULFILLED; // 状态改为成功
        this.value = value; // 兑现值
        this.onFulfilledCbs.forEach((fn) => fn()); // resolve异步时, 注册的回调
      }
    };
    const reject = (reason) => {
      // 状态改变后就不可以更改了
      if (this.status === PENDING) {
        this.status = REJECTED; // 状态改为失败
        this.reason = reason; // 失败原因
        this.onRejectedCbs.forEach((fn) => fn()); // reject异步时, 注册的回调
      }
    };
    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }
  then(onFulfilled, onRejected) {
    // 传入的onFulfilled和onRejected应该为function,若不是函数,则会进行处理

    // 如果 onFulfilled 不是一个函数，则内部会被替换为一个恒等函数（(x) => x），它只是简单地将兑现值向前传递。
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (x) => x;

    // 如果 onRejected 不是一个函数，则内部会被替换为一个抛出器函数（(x) => { throw x; }），它会抛出它收到的拒绝原因。
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (x) => {
            throw x;
          };

    const promise2 = new MyPromise((resolve, reject) => {
      // executor中resolve和reject有同步执行和异步执行两种情况
      const queueMicroHandler = () => {
        if (this.status === FULFILLED) {
          try {
            let x = onFulfilled(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (err) {
            reject(err);
          }
        }
        if (this.status === REJECTED) {
          try {
            let x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (err) {
            reject(err);
          }
        }
      };
      if (this.status !== PENDING) {
        // resolve同步执行, promise此时已敲定后, 立刻将回调加入到微任务队列
        queueMicrotask(queueMicroHandler);
      } else {
        // resolve异步执行, 状态还未改变
        // 发布订阅, 先将回调收集起来, 等promise敲定后, 再按顺序加入到微任务队列中
        this.onFulfilledCbs.push(() => {
          queueMicrotask(queueMicroHandler);
        });
        this.onRejectedCbs.push(() => {
          queueMicrotask(queueMicroHandler);
        });
      }
    });
    return promise2;
  }
  catch(onRejected) {
    return this.then(undefined, onRejected);
  }
  static resolve(value) {
    if (value instanceof MyPromise) {
      return value;
    } else {
      return new MyPromise((resolve, reject) => {
        resolve(value);
      });
    }
  }
  static reject(reason) {
    return new MyPromise((resolve, reject) => {
      reject(reason);
    });
  }
  finally(onFinally) {
    return this.then(
      // onFinally()报错,this.then内部会捕获,并reject
      // 所以只需要关心onFinally返回失败的promise的情况, static resolve会将promise直接返回
      // onFinally返回普通值和成功promise就会走后面的then; 如果返回失败的promise, 后面的then第二个参数没有给, 内部会处理成 (x) => {throw x}, 等于把抛错进行了传递
      (value) => MyPromise.resolve(onFinally()).then(() => value),
      (error) =>
        MyPromise.resolve(onFinally()).then(() => {
          throw error;
        })
    );
  }
  static all(iterable) {
    // iterable: 一个可迭代对象，例如 Array 或 String。
    // 返回值: 一个 Promise，其状态为：
    // 已兑现（already fulfilled），如果传入的 iterable 为空。
    // 异步兑现（asynchronously fulfilled），如果给定的 iterable 中所有的 promise 都已兑现。兑现值是一个数组，其元素顺序与传入的 promise 一致，而非按照兑现的时间顺序排列。如果传入的 iterable 是一个非空但不包含待定的（pending）promise，则返回的 promise 依然是异步兑现，而非同步兑现。
    // 异步拒绝（asynchronously rejected），如果给定的 iterable 中的任意 promise 被拒绝。拒绝原因是第一个拒绝的 promise 的拒绝原因。

    //这里iterable就考虑是promise Array的情况
    iterable = [...iterable];
    return new MyPromise((resolve, reject) => {
      if (iterable.length === 0) {
        resolve();
      } else {
        const results = [];
        iterable.forEach((promise, index) => {
          promise = MyPromise.resolve(promise); // 处理iterable数组中有非promise的情况（有普通值）
          promise.then(
            (value) => {
              results[index] = value;
              if (results.length === iterable.length) {
                resolve(results);
              }
            },
            (error) => {
              reject(error);
            }
          );
        });
      }
    });
  }
  static allSettled(iterable) {
    // iterable: 一个可迭代对象，例如 Array 或 String。
    // 返回值: 一个 Promise，其状态为：
    // 已兑现（already fulfilled），如果传入的 iterable 为空的话。

    // 异步兑现（asynchronously fulfill），当给定的 iterable 中所有 promise 已经敲定时（要么已兑现，要么已拒绝）。兑现的值是一个对象数组，其中的对象按照 iterable 中传递的 promise 的顺序，描述每一个 promise 的结果，无论完成顺序如何。每个结果对象都有以下的属性：
    // status
    // 一个字符串，要么是 "fulfilled"，要么是 "rejected"，表示 promise 的最终状态。
    // value
    // 仅当 status 为 "fulfilled"，才存在。promise 兑现的值。
    // reason
    // 仅当 status 为 "rejected"，才存在，promsie 拒绝的原因。
    // 如果传入的 iterable 是非空的，但不包含待定的（pending）promise，则返回的 promise 仍然是异步兑现的，而不是同步兑现。

    //这里iterable就考虑是promise Array的情况
    iterable = [...iterable];
    return new MyPromise((resolve, reject) => {
      if (iterable.length === 0) {
        resolve();
      } else {
        const results = [];
        iterable.forEach((promise, index) => {
          promise = MyPromise.resolve(promise); // 处理iterable数组中有非promise的情况（有普通值）
          promise.then(
            (value) => {
              results[index] = { status: FULFILLED, value };
              if (results.length === iterable.length) {
                resolve(results);
              }
            },
            (reason) => {
              results[index] = { status: REJECTED, reason };
              if (results.length === iterable.length) {
                resolve(results);
              }
            }
          );
        });
      }
    });
  }
  static any(iterable) {
    // iterable: 一个可迭代对象，例如 Array 或 String。
    // 返回值: 一个 Promise，其状态为：
    // 已拒绝（already rejected），如果传入的 iterable 为空的话。
    // 异步兑现（asynchronously fulfilled），当给定的 iterable 中的任何一个 Promise 被兑现时，返回的 Promise 就会被兑现。其兑现值是第一个兑现的 Promise 的兑现值。
    // 异步拒绝（asynchronously rejected），当给定的 iterable 中的所有 Promise 都被拒绝时。拒绝原因是一个 AggregateError，其 errors 属性包含一个拒绝原因数组。无论完成顺序如何，这些错误都是按照传入的 Promise 的顺序排序。如果传递的 iterable 是非空的，但不包含待定的 Promise，则返回的 Promise 仍然是异步拒绝的（而不是同步拒绝的）。

    //这里iterable就考虑是promise Array的情况
    iterable = [...iterable];
    return new MyPromise((resolve, reject) => {
      if (iterable.length === 0) {
        reject();
      } else {
        const errResults = [];
        iterable.forEach((promise, index) => {
          if (!(promise instanceof MyPromise)) {
            promise = MyPromise.reject(promise); // 处理iterable数组中有非promise的情况（有普通值）
          }
          promise.then(
            (value) => {
              resolve(value);
            },
            (reason) => {
              errResults[index] = reason;
              if (errResults.length === iterable.length) {
                reject(errResults);
              }
            }
          );
        });
      }
    });
  }
  static race(iterable) {
    // iterable: 一个可迭代对象，例如 Array 或 String。
    // 返回值: 一个 Promise，其状态为：
    // 一个 Promise，会以 iterable 中第一个敲定的 promise 的状态异步敲定。换句话说，如果第一个敲定的 promise 被兑现，那么返回的 promise 也会被兑现；如果第一个敲定的 promise 被拒绝，
    // 那么返回的 promise 也会被拒绝。如果传入的 iterable 为空，返回的 promise 就会一直保持待定状态。如果传入的 iterable 非空但其中没有任何一个 promise 是待定状态，
    // 返回的 promise 仍会异步敲定（而不是同步敲定）。

    //这里iterable就考虑是promise Array的情况
    iterable = [...iterable];
    return new MyPromise((resolve, reject) => {
      iterable.forEach((promise) => {
        promise = MyPromise.resolve(promise); // 处理iterable数组中有非promise的情况（有普通值）
        promise.then(
          (value) => {
            resolve(value);
          },
          (reason) => {
            reject(reason);
          }
        );
      });
    });
  }
}

MyPromise.defer = MyPromise.deferred = function () {
  let dfd = {};
  dfd.promise = new MyPromise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
};

module.exports = MyPromise;
