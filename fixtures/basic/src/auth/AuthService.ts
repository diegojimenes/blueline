export class AuthService {
  login(user: string): string {
    return `token:${user}`;
  }
}
