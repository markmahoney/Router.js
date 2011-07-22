from flask import Flask
from flask import render_template
app = Flask(__name__, static_url_path = '/static')

@app.route('/')
@app.route('/<page>.html')
def route(page='test1'):
    return render_template('%s.html' % page)

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0')
