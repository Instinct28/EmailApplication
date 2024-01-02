 const { google } = require("googleapis");

  const {
    CLEINT_ID,
    CLEINT_SECRET,
    REDIRECT_URI,
    REFRESH_TOKEN,
  } = require("./credentials");
  
  //implemented the “Login with google” API here.
  //basically OAuth2 module allow to retrive an access token, refresh it and retry the request.
  const oAuth2Client = new google.auth.OAuth2(
    CLEINT_ID,
    CLEINT_SECRET,
    REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  
  //here using new set() taken care of no double replies are sent to any email at any point. Every email that qualifies the criterion should be replied back with one and only one auto reply
  
  //keep track of users already replied to using repliedUsers
  const repliedUsers = new Set();
  
  //Step 1. check for new emails and sends replies .
  async function checkEmailsAndSendReplies() {
    try {
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  
      // Get the list of unread messages.
      const res = await gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
      });
      const messages = res.data.messages;
  
      if (messages && messages.length > 0) {
        // Fetch the complete message details.
        for (const message of messages) {
          const email = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
          });
          const from = email.data.payload.headers.find(
            (header) => header.name === "From"
          );
          const toHeader = email.data.payload.headers.find(
            (header) => header.name === "To"
          );
          const Subject = email.data.payload.headers.find(
            (header) => header.name === "Subject"
          );
          //who sends email extracted
          const From = from.value;
          //who gets email extracted
          const toEmail = toHeader.value;
          //subject of unread email
          const subject = Subject.value;
          console.log("email come From", From);
          console.log("to Email", toEmail);
          //check if the user already been replied to
          if (repliedUsers.has(From)) {
            console.log("Already replied to : ", From);
            continue;
          }
          // Step 2. Send replies to Emails that have no prior replies
          // Check if the email has any replies.
          const thread = await gmail.users.threads.get({
            userId: "me",
            id: message.threadId,
          });
  
          //isolated the email into threads
          const replies = thread.data.messages.slice(1);
  
          if (replies.length === 0) {
            // Reply to the email.
            await gmail.users.messages.send({
              userId: "me",
              requestBody: {
                raw: await createReplyRaw(toEmail, From, subject),
              },
            });
  
            // Add a label to the email.
            const labelName = "onVacation";
            await gmail.users.messages.modify({
              userId: "me",
              id: message.id,
              requestBody: {
                addLabelIds: [await createLabelIfNeeded(labelName)],
              },
            });
  
            console.log("Sent reply to email:", From);
            //Add the user to replied users set
            repliedUsers.add(From);
          }
        }
      }
    } catch (error) {
      console.error("Error occurred:", error);
    }
  }
  
  //this function is basically converte string to base64EncodedEmail format
  async function createReplyRaw(from, to, subject) {
    const emailContent = `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\nThank you for your message. I am  unavailable right now, but will respond as soon as possible...`;
    const base64EncodedEmail = Buffer.from(emailContent)
      .toString("base64");
  
    return base64EncodedEmail;
  }
  
  // Step 3. Add a Label to the email and move the email to the label
  async function createLabelIfNeeded(labelName) {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    // Check if the label already exists.
    const res = await gmail.users.labels.list({ userId: "me" });
    const labels = res.data.labels;
  
    const existingLabel = labels.find((label) => label.name === labelName);
    if (existingLabel) {
      return existingLabel.id;
    }
  
    // Create the label if it doesn't exist.
    const newLabel = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
  
    return newLabel.data.id;
  }
  
  /*Step 4. Repeat this sequence of steps 1-3 in random intervals of 45 to 120 seconds*/
  function getRandomInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  
  //Setting Interval and calling main function in every interval
  setInterval(checkEmailsAndSendReplies, getRandomInterval(45, 120) * 1000);
  
/* Suggestions for enhancing your code:

  1. Error Handling: Enhance error handling by implementing a more robust mechanism. Although the code currently logs errors during execution, consider implementing a comprehensive error-handling strategy.
  2. Code Efficiency: Optimize the code to handle larger email volumes more efficiently. Evaluate and refine algorithms or processes to enhance overall performance.
  3. Security: Ensure the secure storage of sensitive information, such as client secrets and refresh tokens. Avoid exposing confidential data within the code to minimize potential security risks.
  4. User-Specific Configuration: Increase code flexibility by enabling users to provide personalized configuration options. This could involve integrating features like customizable email filters or user-defined reply messages.
  5. Time Monitoring: Improve the timing mechanism within the code. Instead of using a random interval function, consider integrating a cron jobs package to schedule email tasks more effectively.

  Despite these improvement areas, it's noteworthy that the code successfully implements auto-reply functionality using the Gmail API.

  
Library and Technology Specifications:

  1. Google API Library (googleapis):

  Purpose: The 'googleapis' library is used to interact with various Google services, including Gmail in this code.
  Role in the Code: It provides a convenient way to make requests to the Gmail API, handle authentication, and manage Gmail-related operations.
  Usage in the Code: The library is employed to create an OAuth2 client, send requests to the Gmail API, and perform tasks such as retrieving messages, sending replies, and managing labels.

  2. OAuth2 Authentication:

  Purpose: OAuth2 is an open standard for access delegation, commonly used to secure APIs.
  Role in the Code: The OAuth2 authentication flow is implemented to retrieve an access token, refresh it, and authenticate requests to the Gmail API securely.
  Usage in the Code: The 'OAuth2' class from 'googleapis.auth' is used to set up the OAuth2 client, which is then authenticated using client credentials and a refresh token.
*/