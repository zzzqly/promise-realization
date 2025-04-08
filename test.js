const Promise23 = require("./promise");
// const promise1 = new Promise23((resolve, reject) => {
//   resolve(1);
// });
// const promise1 = new Promise((resolve, reject) => {
//   resolve(1);
// });

// const p2 = promise1.then((data) => {
//   return {
//     then: function () {},
//   };
// });
// setTimeout(() => {
//   console.dir(p2);
// });

// const p3 = new Promise23((res, rej) => {
//   res(9);
// }).then(() => {
//   return p3;
// });
// setTimeout(() => {
//   console.log(p3);
// }, 2000);

// async function asyncFun() {
//   let resA = await 1; //promise对象
//   console.log(233);
//   // let resA = await new Promise((resolve) => {
//   //   setTimeout(() => {
//   //     resolve(1);
//   //   }, 1000);
//   // }); //promise对象
//   let resB = await new Promise((resolve) => {
//     setTimeout(() => {
//       resolve(2);
//     }, 2000);
//   }); //promise对象  // co模块约定，yield命令后面只能是 Thunk 函数或 Promise 对象
//   let resC = await new Promise((resolve) => {
//     setTimeout(() => {
//       resolve(3);
//     }, 3000);
//   }); //promise对象  // 而await后面，可以是Promise 对象和原始类型的值（数值、字符串和布尔值，但这时等同于同步操作）
//   console.log("函数内", resA, resB, resC);
// }
// const p = asyncFun();
// console.log(456);
// setTimeout(() => {
//   console.log(p);
// }, 6100);
// syncFun()
//   .then((data) => {
//     console.log("1then", data);
//   })
//   .then((data) => {
//     console.log("2then", data);
//   })
//   .then((data) => {
//     console.log("3then", data);
//   });

function* generator(i) {
  yield console.log("第一个log");
  const a = yield i;
  console.log(a);
  yield i + 10;
}
const gen = generator(10);
gen.next();
gen.next();
gen.next();
