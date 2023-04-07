const core = require('@actions/core');
const { context } = require('@actions/github');
const axios = require('axios');

const trelloKey = core.getInput('trello-key', { required: true });
const trelloToken = core.getInput('trello-token', { required: true });

const trelloClient = axios.create({
  baseURL: 'https://api.trello.com',
});

const requestTrello = async (verb, url, body = null, extraParams = null) => {
  try {
    const params = {
      ...(extraParams || {}),
      key: trelloKey,
      token: trelloToken,
    };

    const res = await trelloClient.request({
      method: verb,
      url: url,
      data: body || {},
      params: params,
    });
    return res.data;
  } catch (err) {
    core.error(`${verb} to ${url} errored: ${err}`);
    if (err.response) {
      core.error(err.response.data);
    }
    throw err;
  }
};

const getCardAttachments = async (cardId) => {
  return requestTrello('get', `/1/cards/${cardId}/attachments`);
};

const createCardAttachment = async (cardId, attachUrl) => {
  return requestTrello('post', `/1/cards/${cardId}/attachments`, { url: attachUrl });
};

const extractTrelloCardIds = (prBody) => {
  const cardUrlRegex = /https:\/\/trello\.com\/c\/([\w]+)/g;
  const cardIds = [];
  let match;
  while ((match = cardUrlRegex.exec(prBody)) !== null) {
    cardIds.push(match[1]);
  }
  return cardIds;
};

const attachPrToTrelloCard = async (cardId, prUrl) => {
  const attachments = await getCardAttachments(cardId);

  if (attachments.some((attachment) => attachment.url === prUrl)) {
    core.info(`Trello attachment for card ${cardId} already exists - skipped attachment create.`);
    return;
  }

  const createdAttachment = await createCardAttachment(cardId, prUrl);
  core.info(`Created Trello attachment for card ${cardId}.`);
};

(async () => {
  try {
    const prUrl = context.payload.pull_request.html_url;
    const cardIds = extractTrelloCardIds(context.payload.pull_request.body);

    if (cardIds && cardIds.length > 0) {
      for (const cardId of cardIds) {
        await attachPrToTrelloCard(cardId, prUrl);
      }
    } else {
      core.info('No card URLs in PR comment. Nothing to do.');
    }
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
})();
