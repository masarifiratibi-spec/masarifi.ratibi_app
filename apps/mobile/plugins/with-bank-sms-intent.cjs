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
    const catalog = 'Localizable.xcstrings';
    copyFileSync(join(__dirname, '../modules/masarifi-bank-sms', catalog), join(group, catalog));
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
    for (const resource of [parser, catalog]) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        project,
        groupName: projectName,
        filepath: `${projectName}/${resource}`,
        targetUuid,
        isBuildFile: true
      });
    }
    const catalogRef = Object.values(project.pbxFileReferenceSection()).find(
      (file) => file.path?.replaceAll('"', '') === `${projectName}/${catalog}`
    );
    if (!catalogRef) throw Error('Missing Shortcuts string catalog');
    catalogRef.lastKnownFileType = 'text.json.xcstrings';
    return mod;
  });
};
