const { mkdirSync, copyFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { withXcodeProject, IOSConfig } = require('expo/config-plugins');
const {
  bundleBankSmsParser
} = require('../modules/masarifi-bank-sms/bundle-parser.cjs');

module.exports = function withBankSmsIntent(config) {
  return withXcodeProject(config, (mod) => {
    const { projectRoot, platformProjectRoot, projectName } = mod.modRequest;
    const project = mod.modResults;
    const targetUuid = project.getFirstTarget().uuid;
    const group = join(platformProjectRoot, projectName);
    mkdirSync(group, { recursive: true });
    const intent = 'ProcessBankSmsIntent.swift';
    const parser = 'MasarifiBankSmsParser.js';
    copyFileSync(
      join(__dirname, '../modules/masarifi-bank-sms', intent),
      join(group, intent)
    );
    writeFileSync(join(group, parser), bundleBankSmsParser(projectRoot));
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      project,
      groupName: projectName,
      filepath: `${projectName}/${intent}`,
      targetUuid
    });
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      project,
      groupName: projectName,
      filepath: `${projectName}/${parser}`,
      targetUuid,
      isBuildFile: true
    });
    return mod;
  });
};
