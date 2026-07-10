// Mimics the shape of an ApiContract without depending on the core package.
const fakeEndpoint = { responses: {} };

export const contract = {
  definition: {
    somepath: {
      [':myparam']: {
        POST: fakeEndpoint,
      },
    },
    otherpath: {
      POST: fakeEndpoint,
    },
  },
};
