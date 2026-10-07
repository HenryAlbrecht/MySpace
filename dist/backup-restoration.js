/* Existing apply/rollback transaction. Callers own post-restore UI and playback. */
async function restoreProfileBackup(
  { profile, next, titlePreferences, packageData },
  { persist, save },
) {
  const oldProfile = localStorage.getItem("myspace-profile-v1");
  const rollbackMedia = await MediaPackage.restore(packageData?.files || []);
  let rollbackPreferences;
  try {
    rollbackPreferences =
      titlePreferences === null
        ? () => {}
        : TitlePreferences.replace(titlePreferences);
  } catch (error) {
    await rollbackMedia();
    throw error;
  }
  if (!persist(profile)) {
    rollbackPreferences();
    await rollbackMedia();
    throw Error("Não foi possível salvar o perfil.");
  }
  if (!save(next, false)) {
    if (oldProfile) localStorage.setItem("myspace-profile-v1", oldProfile);
    else localStorage.removeItem("myspace-profile-v1");
    rollbackPreferences();
    await rollbackMedia();
    throw Error("Não foi possível importar o backup.");
  }
}
