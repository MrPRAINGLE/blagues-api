import data from '../blagues.json';
import { Joke, JokeTypes } from './typings';
import { random } from './utils';

const jokes = data as Joke[];

interface JokeResponse {
  error: boolean;
  response?: Joke
}

export function randomJoke(disallow?: string[]): JokeResponse {
  let typesForbidden: string[] = [];

  if (disallow) {
    typesForbidden = Array.isArray(disallow)
    ? disallow
    : Array.of(disallow);

    if(typesForbidden.some((type) => !JokeTypes.includes(type))) {
      return {
        error: true
      };
    }
  }

  return {
    error: false,
    response: random(
      typesForbidden.length
        ? jokes.filter((joke: Joke) => !typesForbidden.includes(joke.type))
        : jokes
    )
  };
};

export function randomJokeByType(type: string): JokeResponse {
  if (!JokeTypes.includes(type)) {
    return {
      error: true
    };
  }

  return {
    error: false,
    response: random(jokes.filter((joke: Joke) => joke.type === type))
  };
};

export function jokeById(id: number): Joke | null {
  return jokes.find((joke: Joke) => joke.id === id) ?? null;
};

export const jokesCount = jokes.length;

export function jokeByQuestion(question: string): Joke | null {
  return jokes.find((entry: Joke) => entry.joke === question) ?? null
}
