// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: magic;

// Change these to your usernames!
const user = "bobby";

// API PARAMETERS !important
// WEATHER_API_KEY, you need an Open Weather API Key
// You can get one for free at: https://home.openweathermap.org/api_keys (account needed).
const WEATHER_API_KEY = "";
const DEFAULT_LOCATION = {
  latitude: 0,
  longitude: 0
};
const HOME_ASSISTANT_API_BASE = "";
const HOME_ASSISTANT_API_KEY = "";

const Cache = importModule('cache');

const cache = new Cache("termiWidgetCache");
const data = await fetchData();
const widget = createWidget(data);
Script.setWidget(widget);
Script.complete();

function createWidget(data) {
  console.log(data)
  const w = new ListWidget()
  const bgColor = new LinearGradient()
  bgColor.colors = [new Color("#29323c"), new Color("#1c1c1c")]
  bgColor.locations = [0.0, 1.0]
  w.backgroundGradient = bgColor
  w.setPadding(12, 15, 15, 12)

  const stack = w.addStack();
  stack.layoutHorizontally();

  const leftStack = stack.addStack();
  leftStack.layoutVertically();
  leftStack.spacing = 6;
  leftStack.size = new Size(200, 0);

  const time = new Date()
  const dfTime = new DateFormatter()
  dfTime.locale = "en"
  dfTime.useMediumDateStyle()
  dfTime.useNoTimeStyle()

  const loginTimeFormat = new DateFormatter();
  loginTimeFormat.locale = "en"
  loginTimeFormat.useNoDateStyle();
  loginTimeFormat.useShortTimeStyle();

  const firstLine = leftStack.addText(`Last login: ${loginTimeFormat.string(new Date())} on ttys001`);
  firstLine.textColor = Color.white();
  firstLine.textOpacity = 0.7;
  firstLine.font = new Font("Menlo", 11);

  const secondLine = leftStack.addText(`${user}@iPhone:~$ info`);
  secondLine.textColor = Color.white();
  secondLine.textOpacity = 0.7;
  secondLine.font = new Font("Menlo", 11)
  
  const timeLine = leftStack.addText(`🗓 | ${dfTime.string(time)}`)
  timeLine.textColor = Color.white()
  timeLine.font = new Font("Menlo", 11)
  
  const batteryLine = leftStack.addText(`⚡️ | ${renderBattery()}`)
  batteryLine.textColor = new Color("#6ef2ae")
  batteryLine.font = new Font("Menlo", 11)
  
  const locationLine = leftStack.addText(`📍 | Location: ${data.weather.location}`)
  locationLine.textColor = new Color("#7dbbae")
  locationLine.font = new Font("Menlo", 11)
  
  const homeLine = leftStack.addText(`🏠 | ${data.home.mode}, ${data.home.temperature}°, Lights ${data.home.lights ? "On" : "Off"}, Alarm: ${data.home.alarm}`);
  homeLine.textColor = new Color("#ff9468")
  homeLine.font = new Font("Menlo", 11)

  stack.addSpacer();
  const rightStack = stack.addStack();
  rightStack.spacing = 2;
  rightStack.layoutVertically();
  rightStack.bottomAlignContent();

  addWeatherLine(rightStack, data.weather.icon, 32);
  addWeatherLine(rightStack, `${data.weather.description}, ${data.weather.temperature}°`, 12, true);
  addWeatherLine(rightStack, `High: ${data.weather.high}°`);
  addWeatherLine(rightStack, `Low: ${data.weather.low}°`);
  addWeatherLine(rightStack, `Wind: ${data.weather.wind} mph`);

  return w
}

function addWeatherLine(w, text, size, bold) {
  const stack = w.addStack();
  stack.setPadding(0, 0, 0, 0);
  stack.layoutHorizontally();
  stack.addSpacer();
  const line = stack.addText(text);
  line.textColor = new Color("#ffcc66");
  line.font = new Font("Menlo" + (bold ? "-Bold" : ""), size || 11);
}

async function fetchData() {
  const weather = await fetchWeather();
  const home = await fetchHome();
  
  return {
    weather,
    home,
  }
}

function renderBattery() {
  const batteryLevel = Device.batteryLevel()
  const juice = "#".repeat(Math.floor(batteryLevel * 8))
  const used = ".".repeat(8 - juice.length)
  const batteryAscii = `[${juice}${used}] ${Math.round(batteryLevel * 100)}%`
  return batteryAscii
}

async function fetchWeather() {
  let location = await cache.read('location');
  if (!location) {
    try {
      Location.setAccuracyToThreeKilometers();
      location = await Location.current();
    } catch(error) {
      location = await cache.read('location');
    }
  }
  if (!location) {
    location = DEFAULT_LOCATION;
  }
  const address = await Location.reverseGeocode(location.latitude, location.longitude);
  const url = "https://api.openweathermap.org/data/2.5/onecall?lat=" + location.latitude + "&lon=" + location.longitude + "&exclude=minutely,hourly,alerts&units=imperial&lang=en&appid=" + WEATHER_API_KEY;
  const data = await fetchJson(`weather_${address[0].locality}`, url);

  return {
    location: address[0].locality,
    icon: getWeatherEmoji(data.current.weather[0].id, ((new Date()).getTime() / 1000) >= data.current.sunset),
    description: data.current.weather[0].main,
    temperature: Math.round(data.current.temp),
    wind: Math.round(data.current.wind_speed),
    high: Math.round(data.daily[0].temp.max),
    low: Math.round(data.daily[0].temp.min),
  }
}

async function fetchHome() {
  const mode = await fetchHomeAssistant('states/zone.home');
  const temp = await fetchHomeAssistant('states/sensor.kitchen_motion_sensor_temperature');
  const livingRoomLight = (await fetchHomeAssistant('states/light.living_room')).state == "on";
  const bedRoomLight = (await fetchHomeAssistant('states/light.bedroom')).state == "on";
  const officeLight = (await fetchHomeAssistant('states/light.office')).state == "on";
  const kitchenLight = (await fetchHomeAssistant('states/light.kitchen')).state == "on";
  const alarm = (await fetchHomeAssistant('states/alarm_control_panel.1908_s_bancroft_st_alarm_control_panel'));

  console.log(fetchHomeAssistant('states/light.office'));

  return {
    mode: mode.attributes.friendly_name,
    temperature: Math.round(parseFloat(temp.state)),
    lights: livingRoomLight  || bedRoomLight || officeLight || kitchenLight,
    alarm: alarm.state,
  };
}

async function fetchHomeAssistant(path) {
  return fetchJson(path, `${HOME_ASSISTANT_API_BASE}/api/${path}`, {
    'Authorization': `Bearer ${HOME_ASSISTANT_API_KEY}`,
    'Content-Type': 'application/json',
  });
}


async function fetchJson(key, url, headers) {
  const cached = await cache.read(key, 5);
  if (cached) {
    return cached;
  }

  try {
    console.log(`Fetching url: ${url}`);
    const req = new Request(url);
    req.headers = headers;
    const resp = await req.loadJSON();
    cache.write(key, resp);
    return resp;
  } catch (error) {
    try {
      return cache.read(key, 5);
    } catch (error) {
      console.log(`Couldn't fetch ${url}`);
    }
  }
}

function getWeatherEmoji(code, isNight) {
  if (code >= 200 && code < 300 || code == 960 || code == 961) {
    return "⛈"
  } else if ((code >= 300 && code < 600) || code == 701) {
    return "🌧"
  } else if (code >= 600 && code < 700) {
    return "❄️"
  } else if (code == 711) {
    return "🔥" 
  } else if (code == 800) {
    return isNight ? "🌕" : "☀️" 
  } else if (code == 801) {
    return isNight ? "☁️" : "🌤"  
  } else if (code == 802) {
    return isNight ? "☁️" : "⛅️"  
  } else if (code == 803) {
    return isNight ? "☁️" : "🌥" 
  } else if (code == 804) {
    return "☁️"  
  } else if (code == 900 || code == 962 || code == 781) {
    return "🌪" 
  } else if (code >= 700 && code < 800) {
    return "🌫" 
  } else if (code == 903) {
    return "🥶"  
  } else if (code == 904) {
    return "🥵" 
  } else if (code == 905 || code == 957) {
    return "💨" 
  } else if (code == 906 || code == 958 || code == 959) {
    return "🧊" 
  } else {
    return "❓" 
  }
}