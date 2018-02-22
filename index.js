'use strict';

const _ = require('lodash');

const templates = require('./templates.js');

const defaultParams = {
  initialReadCapacity: 5,
  initialWriteCapacity: 5
};

const defaultAutoScaling = {
  maxReadCapacity: 100,
  minReadCapacity: 5,
  maxWriteCapacity: 100,
  minWriteCapacity: 5,
  readTargetUtilization: 50,
  readScaleInCooldown: 300,
  readScaleOutCooldown: 60,
  writeTargetUtilization: 50,
  writeScaleInCooldown: 300,
  writeScaleOutCooldown: 60
};

const fillParams = (params) => {
  const autoScalingParams = () => {
    if (params.autoScaling === true)
      return { autoScaling: defaultAutoScaling };
    else if (!params.autoScaling)
      return undefined;
    else
      return { autoScaling: Object.assign({}, defaultAutoScaling, params.autoScaling) };
  };

  const mandatoryParams = ['tableName', 'keyAttributeName', 'keyAttributeType'];

  mandatoryParams.forEach(mp => {
    if (!params[mp])
      throw new Error(`Missing mandatory param ${mp} for a dynamodb table definition`);
  });

  return Object.assign({}, defaultParams, params, autoScalingParams());
};

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {};

    this.hooks = {
      'package:initialize': this.createDynamoDbResources.bind(this)
    };
  }

  createDynamoDbResources() {
    const stage = this.serverless.service.provider.stage;
    const existingResources = _.get(this.serverless, 'service.resources.Resources');

    const definitions = _.get(this.serverless, 'service.custom.dynamoDB');

    if (!definitions)
      return;

    const resources = Object.keys(definitions).reduce((acc, key) => {
      const params = fillParams(definitions[key]);
      const tableResources = templates.baseTable(key, params, stage);
      const autoScalingResources = (params.autoScaling) ? templates.autoScaling(key, params.autoScaling) : {};

      return Object.assign({}, acc, tableResources, autoScalingResources);
    }, {});

    const scalingPolicy = Object.keys(definitions).some(key => definitions[key].autoScaling) ? templates.autoScalingPolicy() : {};

    const newResources = Object.assign({}, existingResources, resources, scalingPolicy);

    _.set(this.serverless, 'service.resources.Resources', newResources);

    console.log(JSON.stringify(newResources));
  }
}

module.exports = ServerlessPlugin;
