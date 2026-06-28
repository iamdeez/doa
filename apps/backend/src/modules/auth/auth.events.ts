export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}

export class UserLoggedInEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}

export class UserLoggedOutEvent {
  constructor(public readonly userId: string) {}
}
