const agent = require('../../server/agent');

module.exports = function (Customer) {
  Customer.observe('before save', (context, callback) => {
    if (context.instance && context.instance.__data) {
      const regexResult = /^github\.(.*)/.exec(context.instance.__data.username);
      if (regexResult) {
        context.instance.__data.username = /^github\.(.*)/.exec(context.instance.__data.username)[1];
      }
    }
    callback();
  });

  Customer.prototype.repos = (page, callback) => {
    const createPromise = repo => {
      return new Promise((resolve) => {
        Customer.app.models.Project
          .findOne({where: {id: repo.id}})
          .then(exists => {
            if (exists) {
              repo.configured = true;
            }
            resolve(repo);
          })
      });
    }
    let url = page ? `/user/repos?page=${page}` : '/user/repos';
    agent
      .getWithResponse({url: url})
      .then(res => {
        const regex_last = /.*<https:\/\/api\.github\.com\/user\/repos\?page=(\d)>; rel=\"last\"/;
        let last_page = 1;
        let matched;
        if (res.header.hasOwnProperty('link')) {
          last_page = (matched = regex_last.exec(res.header.link)) ? Number.parseInt(matched[1]) : page;
        }
        let repos = Promise.all(res.body.map(repo => createPromise(repo))).then(repos_res => {
          let current_page = page ? page : 1;
          callback(null, {pageCurrent: current_page , pageTotal: last_page, repos: repos_res});
        });
      })
      .catch(err => callback(err));
  };

  Customer.remoteMethod('repos', {
    description: 'Fetch all repositories on Github that user has access to.',
    http: {
      verb: 'get'
    },
    accepts: {arg: "page", type: "number"},
    isStatic: false,
    returns: {
      arg: 'repos',
      type: 'any'
    }
  });
};
