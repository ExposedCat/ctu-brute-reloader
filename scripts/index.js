console.log(`[BR] BRUTE Reloader connected`);

let cleanup = () => {};
const settings = {
  uploadLifetime: 2 * 60 * 1000,
};

const activeTab = document.querySelector("li.active > a");
if (!activeTab) {
  throw new Error(`[BR] Cannot get homework details: homework is not selected`);
}
let activeHomeworkId = activeTab.getAttribute("href")?.slice(1);
console.info(`[BR] Opened homework ID is ${activeHomeworkId}`);
const homeworkSelectObserver = new MutationObserver((list) => {
  activeHomeworkId = list
    .find((it) => it.target.classList.contains("active"))
    ?.target?.firstChild?.getAttribute("href")
    ?.slice(1);
  console.info(`[BR] Opened homework ID changed to ${activeHomeworkId}`);
  cleanup();
  cleanup = observeState(activeHomeworkId);
});
document
  .querySelector("#assignment_tabs")
  .querySelectorAll("li")
  .forEach((li) => homeworkSelectObserver.observe(li, { attributes: true }));

cleanup = observeState(activeHomeworkId);

function stopReloading() {
  chrome.storage.local.set({ [activeHomeworkId]: false });
}

function observeState(activeHomeworkId) {
  if (!activeHomeworkId) {
    throw new Error(
      `[BR] Cannot get homework details: homework details wrapper ID not found`
    );
  }

  const progressBar = document.querySelector(`#upload_file_${activeHomeworkId}_success`);
  if (!progressBar) {
    throw new Error(`[BR] Cannot observe state: progress bar not found`);
  }
  const observer = new MutationObserver(() => {
    chrome.storage.local
      .set({ [activeHomeworkId]: true })
      .then(() => window.location.reload());
  });
  observer.observe(progressBar, { childList: true });

  const activeHomeworkWrapper = document.getElementById(activeHomeworkId);
  if (!activeHomeworkWrapper) {
    throw new Error(
      `[BR] Cannot get homework details: homework details wrapper not found`
    );
  }

  const isEvaluated = ![
    ...activeHomeworkWrapper.querySelectorAll(".col-sm-9"),
  ].find((it) => it.innerText.startsWith("Not yet evaluated."));
  console.info(`Opened homework is ${isEvaluated ? "" : "not "}evaluated`);

  const uploadedAt = [
    ...activeHomeworkWrapper.querySelectorAll(".col-sm-9 > a"),
  ].find((it) => it.innerText.startsWith("Uploaded at"));
  let recentlyUploaded = !!uploadedAt;
  if (uploadedAt) {
    const [_, day, month, year, hour, minute] = uploadedAt.innerText.match(
      /Uploaded at (\d+).(\d+).(\d+) (\d+):(\d+)/
    );
    const uploadDate = new Date(year, month - 1, day, hour, minute);
    console.info(
      `Opened homework was uploaded at ${uploadDate.toLocaleString("UA")}`
    );
    if (Date.now() - uploadDate > settings.uploadLifetime) {
      recentlyUploaded = false;
    }
  }

  if (uploadedAt && recentlyUploaded && !isEvaluated) {
    chrome.storage.local.get([activeHomeworkId]).then((shouldReload) => {
      if (shouldReload) {
        console.info("Reloading page...");
        window.location.reload();
      } else {
        console.info(
          "Homework is being evaluated manually - no need to reload"
        );
        stopReloading();
      }
    });
  } else {
    stopReloading();
    if (!uploadedAt) {
      console.info("Homework was not uploaded - no need to reload");
    } else if (isEvaluated) {
      console.info("Homework is already evaluated - no need to reload");
    } else if (!recentlyUploaded) {
      console.info(
        "Homework upload is too old - probably would be evaluated manually"
      );
    }
  }

  return () => observer.disconnect();
}
