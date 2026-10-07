// Hardens the packaged Electron binary: no `ELECTRON_RUN_AS_NODE`, no Node inspector flags,
// the app may only load code from its own archive, and the session cookies are encrypted at rest.
const path = require("path");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  const name = packager.appInfo.productFilename;
  const executable =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, `${name}.app`, "Contents", "MacOS", name)
      : electronPlatformName === "win32"
        ? path.join(appOutDir, `${name}.exe`)
        : path.join(appOutDir, name);

  await flipFuses(executable, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: electronPlatformName === "darwin",
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  });
};
