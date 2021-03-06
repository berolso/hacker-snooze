$(async function () {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  // MY:
  const $mainNavLinks = $(".main-nav-links");
  const $navWelcome = $("#nav-welcome");
  const $navSubmit = $("#nav-submit");
  const $navMyStories = $("#nav-my-stories");
  const $navFavorites = $("#nav-favorites");
  //:MY
  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();

    //refresh content
    await generateStories();
    $allStoriesList.show();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function () {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function () {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function () {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  //MY: nav submit click
  $navSubmit.on("click", async () => {
    $submitForm.slideToggle();
  });
  //click nav favorites
  $navFavorites.on("click", async () => {
    $submitForm.hide()
    generateFavorites();
  });
  //click nav my-stories
  $navMyStories.on("click", async () => {
    $submitForm.hide()
    generateMyStories();
  });

  //submit gather data and submit form
  $submitForm.on("submit", async (evt) => {
    evt.preventDefault();
    //collect values
    const author = $("#author").val();
    const title = $("#title").val();
    const url = $("#url").val();
    //assemble vallues into object
    const newStory = { author, title, url };
    //call on addStory static method from StoryList class. submit token from localStorage
    const response = await StoryList.addStory(
      localStorage.getItem("token"),
      newStory
    );
    //close submit form and refresh stories
    $submitForm.slideToggle();
    //update ownstories
    currentUser.ownStories.push(response.data.story);
    await generateStories();
  });

  //handle heart icon click to add to favorites list
  $("body").on("click", ".fa-heart", async (evt) => {
    //check to see if isFavorite
    let isFavorite = [...evt.target.classList].some((x) => x === "fas");
    evt.target.classList.toggle("far");
    evt.target.classList.toggle("fas");
    //toggle favorite
    let response = isFavorite
      ? await User.removeFavorite(
          currentUser.username,
          evt.target.parentElement.id,
          localStorage.getItem("token")
        )
      : await User.addFavorite(
          currentUser.username,
          evt.target.parentElement.id,
          localStorage.getItem("token")
        );
    //update currentUser favorites list with response
    currentUser.favorites = response.data.user.favorites;
  });

  //delete icon action
  $("body").on("click", ".fa-trash", async (evt) => {
    //delete story from api
    const response = await StoryList.deleteStory(
      currentUser.loginToken,
      evt.target.parentElement.id
    );
    //update current user ownStories
    currentUser.ownStories = currentUser.ownStories.filter(
      (x) => x.storyId !== response.data.story.storyId
    );
    //refresh list
    await generateMyStories();
  });
  //:MY

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stori
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }
  //MY: generate my stories list
  // (this could be factored into generateStories with an argument to make more concise code, but i'm opting for separation to preserve independence)
  async function generateMyStories() {
    //get current instance of story list
    const storyListInstance = await StoryList.getStories();
    //update global varaible
    storyList = storyListInstance;
    //clear all stories list
    $allStoriesList.empty();
    //get my stories from StoryList
    for (let story of currentUser.ownStories) {
      //generate html with admin
      const result = generateAdminHTML(story);
      $allStoriesList.append(result);
    }
  }
  //generat favorites
  async function generateFavorites() {
    //get current instance of story list
    const storyListInstance = await StoryList.getStories();
    //update global varaible
    storyList = storyListInstance;
    //clear all stories list
    $allStoriesList.empty();
    for (let story of currentUser.favorites) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  //:MY

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);
    //MY: check to see if logged in and if story is in user favorites array
    let isFavorite = currentUser
      ? currentUser.favorites.some((x) => x.storyId === story.storyId)
      : null;
    // ternary to add correct icon
    let favoriteHTML = currentUser
      ? `<i class="${isFavorite ? "fas" : "far"} fa-heart"></i>
      `
      : "";
    // render story markup
    //prepend list item with heart icon if logged in.
    const storyMarkup = $(
      `
      <li id="${story.storyId}">` +
        favoriteHTML +
        // :MY
        `<a class="article-link" href="${story.url}" target="a_blank">
      <strong>${story.title}</strong>
      </>
      <small class="article-author">by ${story.author}</small>
      <small class="article-hostname ${hostName}">(${hostName})</small>
      <small class="article-username">posted by ${story.username}</small>
      </li>
    `
    );

    return storyMarkup;
  }

  //MY: generate html with admin options (delete...)
  function generateAdminHTML(story) {
    let hostName = getHostName(story.url);
    //check to see if storyId is in user favorites array
    let isFavorite = currentUser.favorites.some(
      (x) => x.storyId === story.storyId
    );
    //check to see if is ownStory
    let isMyStory = currentUser.ownStories.some(
      (x) => x.storyId === story.storyId
    );
    //add trash can icon to delete
    const storyMarkup = $(`
      <li id="${story.storyId}">
      <i class="${isFavorite ? "fas" : "far"} fa-heart"></i>
      ${isMyStory ? '<i class="fas fa-trash"></i>' : ""}
      <a class="article-link" href="${story.url}" target="a_blank">
      <strong>${story.title}</strong>
      </>
      <small class="article-author">by ${story.author}</small>
      <small class="article-hostname ${hostName}">(${hostName})</small>
      <small class="article-username">posted by ${story.username}
      
      </small>
      </li>
    `);

    return storyMarkup;
  }
  //:MY

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
    ];
    elementsArr.forEach(($elem) => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    // MY: show main nav menu options
    $mainNavLinks.toggleClass("hidden");
    $navWelcome.show();
    //:MY
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
