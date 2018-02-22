const attribute = (name, type) => ({
  AttributeName: name,
  AttributeType: type
});
const keySchema = (name, keyType) => ({
  AttributeName: name,
  KeyType: keyType
});

module.exports = {
  baseTable: (id, params, stage) => {
    const attributes = (params.sortKeyAttributeName)
      ? [attribute(params.keyAttributeName, params.keyAttributeType), attribute(params.sortKeyAttributeName, params.sortKeyAttributeType)]
      : [attribute(params.keyAttributeName, params.keyAttributeType)];

    const keys = (params.sortKeyAttributeName)
      ? [keySchema(params.keyAttributeName, 'HASH'), keySchema(params.sortKeyAttributeName, 'RANGE')]
      : [keySchema(params.keyAttributeName, 'HASH')];

    const mainObject = {
      [id + 'DynamoDBTable']: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: `${stage}-${params.tableName}`,
          AttributeDefinitions: attributes,
          KeySchema: keys,
          ProvisionedThroughput: {
            ReadCapacityUnits: params.initialReadCapacity,
            WriteCapacityUnits: params.initialWriteCapacity
          }
        }
      }
    };

    return mainObject;
  },

  autoScaling: (id, params) => {
    return {
      [id + 'ReadCapacityScalableTarget']: {
        Type: 'AWS::ApplicationAutoScaling::ScalableTarget',
        Properties: {
          'MaxCapacity': params.maxReadCapacity,
          'MinCapacity': params.minReadCapacity,
          'ResourceId': {
            'Fn::Join': [
              '/',
              [
                'table',
                {
                  'Ref': id + 'DynamoDBTable'
                }
              ]
            ]
          },
          'RoleARN': {
            'Fn::GetAtt': [
              'ServerlessDynamoDBAutoScalingRole',
              'Arn'
            ]
          },
          'ScalableDimension': 'dynamodb:table:ReadCapacityUnits',
          'ServiceNamespace': 'dynamodb'
        }
      },
      [id + 'WriteCapacityScalableTarget']: {
        'Type': 'AWS::ApplicationAutoScaling::ScalableTarget',
        'Properties': {
          'MaxCapacity': params.maxWriteCapacity,
          'MinCapacity': params.minWriteCapacity,
          'ResourceId': {
            'Fn::Join': [
              '/',
              [
                'table',
                {
                  'Ref': id + 'DynamoDBTable'
                }
              ]
            ]
          },
          'RoleARN': {
            'Fn::GetAtt': [
              'ServerlessDynamoDBAutoScalingRole',
              'Arn'
            ]
          },
          'ScalableDimension': 'dynamodb:table:WriteCapacityUnits',
          'ServiceNamespace': 'dynamodb'
        }
      },
      [id + 'ReadScalingPolicy']: {
        'Type': 'AWS::ApplicationAutoScaling::ScalingPolicy',
        'Properties': {
          'PolicyName': 'ReadAutoScalingPolicy',
          'PolicyType': 'TargetTrackingScaling',
          'ScalingTargetId': {
            'Ref': id + 'ReadCapacityScalableTarget'
          },
          'TargetTrackingScalingPolicyConfiguration': {
            'TargetValue': params.readTargetUtilization,
            'ScaleInCooldown': params.readScaleInCooldown,
            'ScaleOutCooldown': params.readScaleOutCooldown,
            'PredefinedMetricSpecification': {
              'PredefinedMetricType': 'DynamoDBReadCapacityUtilization'
            }
          }
        }
      },
      [id + 'WriteScalingPolicy']: {
        'Type': 'AWS::ApplicationAutoScaling::ScalingPolicy',
        'Properties': {
          'PolicyName': 'WriteAutoScalingPolicy',
          'PolicyType': 'TargetTrackingScaling',
          'ScalingTargetId': {
            'Ref': id + 'WriteCapacityScalableTarget'
          },
          'TargetTrackingScalingPolicyConfiguration': {
            'TargetValue': params.writeTargetUtilization,
            'ScaleInCooldown': params.writeScaleInCooldown,
            'ScaleOutCooldown': params.writeScaleOutCooldown,
            'PredefinedMetricSpecification': {
              'PredefinedMetricType': 'DynamoDBWriteCapacityUtilization'
            }
          }
        }
      }
    };
  },

  autoScalingPolicy: () => {
    return {
      'ServerlessDynamoDBAutoScalingRole': {
        'Type': 'AWS::IAM::Role',
        'Properties': {
          'AssumeRolePolicyDocument': {
            'Version': '2012-10-17',
            'Statement': [
              {
                'Effect': 'Allow',
                'Principal': {
                  'Service': [
                    'application-autoscaling.amazonaws.com'
                  ]
                },
                'Action': [
                  'sts:AssumeRole'
                ]
              }
            ]
          },
          'Path': '/',
          'Policies': [
            {
              'PolicyName': 'ServerlessDynamoDBAutoScalingPolicy',
              'PolicyDocument': {
                'Version': '2012-10-17',
                'Statement': [
                  {
                    'Effect': 'Allow',
                    'Action': [
                      'dynamodb:DescribeTable',
                      'dynamodb:UpdateTable',
                      'cloudwatch:PutMetricAlarm',
                      'cloudwatch:DescribeAlarms',
                      'cloudwatch:GetMetricStatistics',
                      'cloudwatch:SetAlarmState',
                      'cloudwatch:DeleteAlarms'
                    ],
                    'Resource': '*'
                  }
                ]
              }
            }
          ]
        }
      }
    };
  }
};