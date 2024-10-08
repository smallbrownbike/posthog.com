import CodeBlock from 'components/Home/CodeBlock'
import React from 'react'

function BuildTest() {
    return (
        <div className="-mt-5">
            <p className="leading-tight">
                Experiments are built on feature flags. Define the variants and use <code>getFeatureFlag</code> to serve
                content for each variant.
            </p>
            <CodeBlock
                code={`posthog.getFeatureFlag('my-flag') === "test" ? <TestComponent /> : <ControlComponent />`}
                language="js"
            />
            <p className="leading-tight">
                Set up rules for variants (like audience, distribution) inside the PostHog app.
            </p>
        </div>
    )
}

export default [
    {
        title: 'Setting up an experiment',
        body: BuildTest,
        bodyType: 'component',
        code: ['getFeatureFlag'],
    },
]
