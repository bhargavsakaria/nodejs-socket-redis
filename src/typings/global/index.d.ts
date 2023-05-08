declare namespace Express {
  export interface Response {
    deliver: (status: number, message: string, payload?: any) => void;
    /**
     * @params result -> final result of the specific api
     * @params message -> optional param
     * @params code -> optional warning code
     */
    mobDeliver: (result: any, message?: string) => void;
  }
}
