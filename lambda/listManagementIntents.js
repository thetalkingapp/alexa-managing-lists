const Alexa = require('ask-sdk-core');

const LIST_NAME = 'Disney Attractions';

const AddItemIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddItemIntent';
  },
  async handle(handlerInput) {
    const { serviceClientFactory, responseBuilder } = handlerInput;
    const listClient = serviceClientFactory.getListManagementServiceClient();

    var attractionList = await getList(handlerInput);
    if (!attractionList) {
        attractionList = await makeList(handlerInput);
    }

    if (!attractionList) {
        return sendListPermissionsCard(responseBuilder)
            .getResponse();
    }

    const listId = attractionList.listId;
    const attractionSlot = handlerInput.requestEnvelope.request.intent.slots.attraction;
    const attraction = attractionSlot.resolutions.resolutionsPerAuthority[0].values[0].value.name;

    try {
        await listClient.createListItem(listId, {
            "value": attraction,
            "status": "active"
        });
    } catch (error) {
        return sendListPermissionsCard(responseBuilder);
    }

    const speakOutput = `I've added ${attraction} to your list. What else would you like to add?`;
    return responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
  }
};

const ListContentsIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ListContentsIntent';
  },
  async handle(handlerInput) {
    const { responseBuilder } = handlerInput;

    const list = await getListItems(handlerInput);
    const items = list.items;

    var itemNames = [];
    for(var i=0; i<items.length; i++) {
        const element = items[i];
        itemNames.push(element.value);
    };

    const joinedNames = itemNames.join(', ').replace(/, ([^,]*)$/, ' and $1');

    const speakOutput = 'You have these items in your list: ' + joinedNames + '. What else would you like to do?';
    return responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
  }
};

const CompleteItemIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CompleteItemIntent';
  },
  async handle(handlerInput) {
    const { serviceClientFactory, responseBuilder } = handlerInput;
    const listClient = serviceClientFactory.getListManagementServiceClient();
    const attractionSlot = handlerInput.requestEnvelope.request.intent.slots.attraction;
    const attraction = attractionSlot.resolutions.resolutionsPerAuthority[0].values[0].value.name;

    const list = await getListItems(handlerInput);
    const items = list.items;
    const listId = list.listId;

    const matchingItems = items.filter(item => item.value === attraction);
    if (matchingItems.length === 0) {
        return responseBuilder
            .speak(`You don't have ${attraction} on your list. What else would you like to do?`)
            .reprompt(`What else would you like to do?`)
            .getResponse();
    }

    console.log("matchingItems", matchingItems);

    try {
        await listClient.updateListItem(listId, matchingItems[0].id, {
            "id": matchingItems[0].id,
            "value": matchingItems[0].value,
            "version": matchingItems[0].version,
            "status": "completed"
        });
    } catch (error) {
        console.log(error);
    }

    const speakOutput = `I've marked ${attraction} as completed. What next?`;
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const getList = async (handlerInput) => {
    const { serviceClientFactory } = handlerInput;
    const listsMetadata = await serviceClientFactory.getListManagementServiceClient().getListsMetadata();
    const lists = listsMetadata.lists;
    const attractionsLists = lists.filter(list => list.name === LIST_NAME);
    return attractionsLists.length > 0 ? attractionsLists[0] : null;
};

const getListItems = async (handlerInput) => {
    const { serviceClientFactory, responseBuilder } = handlerInput;
    const listClient = serviceClientFactory.getListManagementServiceClient();

    var attractionList = await getList(handlerInput);
    if (!attractionList) {
        attractionList = await makeList(handlerInput);
    }

    if (!attractionList) {
        return sendListPermissionsCard(responseBuilder)
            .getResponse();
    }

    const listId = attractionList.listId;

    try {
        const list = await listClient.getList(listId, 'active');
        return list;
    } catch (error) {
        return [];
    }
};

const makeList = async(handlerInput) => {
    try {
        const { serviceClientFactory } = handlerInput;
        const listClient = serviceClientFactory.getListManagementServiceClient();    
        const response = await listClient.createList({
            'name': LIST_NAME,
            'state': 'active'
        });
        return response;
    } catch (error) {
        return null;
    }
};

const sendListPermissionsCard = (responseBuilder) => {
    const speakOutput = 'Please grant permission to access your lists in the Alexa app.';
    return responseBuilder
        .speak(speakOutput)
        .withAskForPermissionsConsentCard([
            'alexa::household:lists:read',
            'alexa::household:lists:write'
        ]);
};

module.exports = {
    AddItemIntentHandler: AddItemIntentHandler,
    ListContentsIntentHandler: ListContentsIntentHandler,
    CompleteItemIntentHandler: CompleteItemIntentHandler
};